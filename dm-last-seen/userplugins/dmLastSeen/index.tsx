/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { getCurrentChannel } from "@utils/discord";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import {
    ChannelStore,
    FluxDispatcher,
    PresenceStore,
    React,
    RelationshipStore,
    SelectedChannelStore,
    useEffect,
    useState,
    useStateFromStores
} from "@webpack/common";

import {
    applyFluxStatusBatch,
    applyFluxStatusChange,
    bootstrapSession,
    ensureUserTracked,
    flushPresenceNotify,
    formatStatusLabel,
    formatStatusTooltip,
    getLiveStatus,
    getTrackableUserIds,
    normalizeStatus,
    sessionRecords,
    subscribePresence
} from "./store";
import type { TrackableStatus } from "./types";

function getDm(channelProp?: Channel | null) {
    if (channelProp?.isDM?.()) return channelProp;

    const wrapped = channelProp as { channel?: Channel; } | null | undefined;
    if (wrapped?.channel?.isDM?.()) return wrapped.channel;

    const cur = getCurrentChannel();
    if (cur?.isDM?.()) return cur;

    const selId = SelectedChannelStore.getChannelId();
    const sel = selId ? ChannelStore.getChannel(selId) : null;
    if (sel?.isDM?.()) return sel;

    return null;
}

function PresenceTag({ userId, inline }: { userId: string; inline?: boolean; }) {
    const [, bump] = useState(0);

    useEffect(() => subscribePresence(() => bump(n => n + 1)), []);

    // need record before first paint or label is empty
    ensureUserTracked(userId, true);

    const label = formatStatusLabel(userId);

    useEffect(() => {
        if (!label?.includes("-")) return;
        const t = setInterval(() => bump(n => n + 1), 30_000);
        return () => clearInterval(t);
    }, [userId, label]);

    if (!label) return null;

    const cls = inline !== false ? "vc-dm-last-seen" : "vc-dm-last-seen vc-dm-last-seen-block";

    return (
        <span className={cls} title={formatStatusTooltip(userId)}>
            {label}
        </span>
    );
}

function DmPresenceInfo({ channel: channelProp, userId: userIdProp, inline }: {
    channel?: Channel | null;
    userId?: string | null;
    inline?: boolean;
}) {
    const channel = useStateFromStores(
        [SelectedChannelStore, ChannelStore],
        () => getDm(channelProp),
        null,
        (a, b) => a?.id === b?.id
    );

    const userId = userIdProp ?? channelProp?.getRecipientId?.() ?? channel?.getRecipientId?.() ?? null;
    if (!userId) return null;

    return <PresenceTag userId={userId} inline={inline} />;
}

export default definePlugin({
    name: "DmLastSeen",
    description: "on / idle / last seen text next to dm names. ? = unknown time",
    authors: [{ name: "selxxet", id: 0n }],
    dependencies: ["MemberListDecoratorsAPI"],

    patches: [
        {
            find: "PrivateChannel.renderAvatar: Invalid prop configuration",
            replacement: {
                match: /(userName:e\$,displayNameStyles:o\?\.displayNameStyles,)(effectDisplayType)/,
                replace: "$1appendedInlineContent:$self.getDmPresenceElement(t),$2"
            }
        },
        {
            find: "g.Title=d.Ay.Title,g.Icon=d.Ay.Icon",
            replacement: {
                match: /(Title=e=>\{let\{className:\i,wrapperClassName:\i,children:)(\i)(,)/,
                replace: "$1$self.wrapNameWithPresence($2)$3",
                noWarn: true
            }
        }
    ],

    renderMemberListDecorator({ user, channel, type }) {
        if (type !== "dm" || !user?.id) return null;
        return React.createElement(PresenceTag, { userId: user.id, inline: true });
    },

    wrapNameWithPresence(name: React.ReactNode) {
        const channel = getDm();
        if (!channel?.isDM?.()) return name;

        return React.createElement(
            React.Fragment,
            { key: "vc-dm-presence-wrap" },
            name,
            React.createElement(this.DmPresenceInfo, { key: "vc-dm-presence", channel, inline: true })
        );
    },

    getDmPresenceElement(channel: Channel | null | undefined) {
        if (!channel?.isDM?.()) return null;
        return React.createElement(this.DmPresenceInfo, { key: "vc-dm-presence-nitro", channel, inline: true });
    },

    DmPresenceInfo: ErrorBoundary.wrap(DmPresenceInfo, { noop: true }),

    presenceListener: null as (() => void) | null,
    presenceFluxHandler: null as ((payload: any) => void) | null,
    presenceReplaceHandler: null as ((payload: any) => void) | null,
    presenceSyncTimer: null as ReturnType<typeof setTimeout> | null,

    schedulePresenceSync() {
        if (this.presenceSyncTimer) return;

        this.presenceSyncTimer = setTimeout(() => {
            this.presenceSyncTimer = null;

            for (const userId of getTrackableUserIds()) {
                const live = getLiveStatus(userId);
                const rec = sessionRecords.get(userId);
                if (!rec) continue;
                if (rec.status !== live) applyFluxStatusChange(userId, live, false, true);
            }
            flushPresenceNotify();
        }, 300);
    },

    onPresenceFlux(payload: any, fromReplace = false) {
        const stuff = payload?.updates ?? payload?.presences ?? payload;
        if (!stuff) return;

        const batch: Array<{ userId: string; status: TrackableStatus; }> = [];

        const add = (userId: string, status?: string | null) => {
            if (!userId) return;
            batch.push({ userId, status: normalizeStatus(status ?? PresenceStore.getStatus(userId)) });
        };

        if (Array.isArray(stuff)) {
            for (const u of stuff) add(u?.user?.id ?? u?.userId, u?.status);
        } else if (typeof stuff === "object") {
            for (const [userId, data] of Object.entries(stuff)) {
                if (!/^\d{17,20}$/.test(userId)) continue;
                add(userId, (data as { status?: string; }).status);
            }
        }

        if (batch.length) applyFluxStatusBatch(batch, fromReplace);
    },

    start() {
        bootstrapSession();

        for (const id of RelationshipStore.getFriendIDs()) ensureUserTracked(id, true);
        for (const ch of ChannelStore.getSortedPrivateChannels()) {
            if (!ch.isDM?.()) continue;
            const rid = ch.getRecipientId();
            if (rid) ensureUserTracked(rid, true);
        }

        this.presenceListener = () => this.schedulePresenceSync();
        PresenceStore.addChangeListener(this.presenceListener);

        this.presenceFluxHandler = (p: any) => this.onPresenceFlux(p, false);
        this.presenceReplaceHandler = (p: any) => this.onPresenceFlux(p, true);
        FluxDispatcher.subscribe("PRESENCE_UPDATES", this.presenceFluxHandler);
        FluxDispatcher.subscribe("PRESENCES_REPLACE", this.presenceReplaceHandler);
    },

    stop() {
        if (this.presenceSyncTimer) {
            clearTimeout(this.presenceSyncTimer);
            this.presenceSyncTimer = null;
        }
        if (this.presenceListener) {
            PresenceStore.removeChangeListener(this.presenceListener);
            this.presenceListener = null;
        }
        if (this.presenceFluxHandler) {
            FluxDispatcher.unsubscribe("PRESENCE_UPDATES", this.presenceFluxHandler);
            this.presenceFluxHandler = null;
        }
        if (this.presenceReplaceHandler) {
            FluxDispatcher.unsubscribe("PRESENCES_REPLACE", this.presenceReplaceHandler);
            this.presenceReplaceHandler = null;
        }
    },

    flux: {
        CONNECTION_OPEN() {
            bootstrapSession();
        },
        CHANNEL_SELECT({ channelId }: { channelId?: string; }) {
            const ch = channelId ? ChannelStore.getChannel(channelId) : null;
            if (!ch?.isDM?.()) return;
            const rid = ch.getRecipientId();
            if (rid) ensureUserTracked(rid, true);
        },
        RELATIONSHIP_ADD() {
            for (const id of RelationshipStore.getFriendIDs()) ensureUserTracked(id, true);
        }
    }
});
