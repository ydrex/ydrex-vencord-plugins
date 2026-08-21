/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, PresenceStore, RelationshipStore, SelectedChannelStore } from "@webpack/common";

import type { TrackableStatus } from "./types";
import { normalizeStatus } from "./types";

export { normalizeStatus } from "./types";

interface UserRecord {
    status: TrackableStatus;
    statusSince: number;
    preSession: boolean; // true = we dont know how long theyve been like this
}

export const sessionRecords = new Map<string, UserRecord>();
export let sessionStartedAt = Date.now();

const listeners = new Set<() => void>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

export function getLiveStatus(userId: string) {
    return normalizeStatus(PresenceStore.getStatus(userId));
}

export function subscribePresence(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function notify() {
    if (notifyTimer) return;
    notifyTimer = setTimeout(() => {
        notifyTimer = null;
        for (const l of listeners) l();
    }, 100);
}

function flushNotify() {
    if (notifyTimer) {
        clearTimeout(notifyTimer);
        notifyTimer = null;
    }
    for (const l of listeners) l();
}

export { flushNotify as flushPresenceNotify };

export function getTrackableUserIds() {
    const ids = new Set<string>();

    for (const id of PresenceStore.getUserIds()) ids.add(id);
    for (const id of RelationshipStore.getFriendIDs()) ids.add(id);

    for (const ch of ChannelStore.getSortedPrivateChannels()) {
        if (!ch.isDM?.()) continue;
        const rid = ch.getRecipientId();
        if (rid) ids.add(rid);
    }

    const openId = SelectedChannelStore.getChannelId();
    if (openId) {
        const open = ChannelStore.getChannel(openId);
        if (open?.isDM?.()) {
            const rid = open.getRecipientId();
            if (rid) ids.add(rid);
        }
    }

    return [...ids];
}

function shouldHideDuration(record: UserRecord) {
    return record.preSession;
}

export function applyStatusChange(userId: string, newStatus: TrackableStatus, preSession = true, silent = false) {
    const prev = sessionRecords.get(userId);
    if (prev?.status === newStatus) return false;

    sessionRecords.set(userId, {
        status: newStatus,
        statusSince: Date.now(),
        preSession
    });

    if (!silent) notify();
    return true;
}

function keepUnknown(prev: UserRecord, newStatus: TrackableStatus, fromReplace: boolean) {
    if (fromReplace) return true;
    if (!prev.preSession) return false;
    if (prev.status === newStatus) return true;
    if (prev.status === "offline" && newStatus !== "offline") return true; // bootstrap noise
    if (Date.now() - sessionStartedAt < 5000) return true; // right after connect
    return false;
}

export function applyFluxStatusChange(userId: string, newStatus: TrackableStatus, fromReplace = false, silent = false) {
    if (!userId) return false;

    const prev = sessionRecords.get(userId);
    if (!prev) {
        ensureUserTracked(userId, true);
        return false;
    }
    if (prev.status === newStatus) return false;

    return applyStatusChange(userId, newStatus, keepUnknown(prev, newStatus, fromReplace), silent);
}

export function applyFluxStatusBatch(
    entries: Array<{ userId: string; status: TrackableStatus; }>,
    fromReplace = false
) {
    let changed = false;
    for (const { userId, status } of entries) {
        if (applyFluxStatusChange(userId, status, fromReplace, true)) changed = true;
    }
    if (changed) flushNotify();
}

export function ensureUserTracked(userId: string, preSession = true) {
    if (!userId) return;

    const live = getLiveStatus(userId);
    const now = Date.now();

    if (!sessionRecords.has(userId)) {
        sessionRecords.set(userId, { status: live, statusSince: now, preSession: true });
        notify();
        return;
    }

    const rec = sessionRecords.get(userId)!;
    if (rec.status !== live) {
        applyStatusChange(userId, live, rec.preSession ? true : false);
    }
}

export function bootstrapSession() {
    sessionStartedAt = Date.now();

    for (const userId of getTrackableUserIds()) {
        sessionRecords.set(userId, {
            status: getLiveStatus(userId),
            statusSince: sessionStartedAt,
            preSession: true
        });
    }

    flushNotify();
}

function formatDuration(ms: number) {
    if (ms < 0) return "now";

    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;

    const days = Math.floor(hrs / 24);
    if (days === 1) return "1d";
    return `${days}d`;
}

export function formatStatusTooltip(userId: string) {
    const rec = sessionRecords.get(userId);
    if (!rec || !shouldHideDuration(rec)) return undefined;
    return "duration unknown";
}

export function formatStatusLabel(userId: string) {
    const rec = sessionRecords.get(userId);
    if (!rec) return null;

    const live = getLiveStatus(userId);

    let word: string;
    switch (live) {
        case "online": word = "on"; break;
        case "idle": word = "idle"; break;
        case "dnd": word = "dnd"; break;
        default: word = "last seen"; break;
    }

    if (shouldHideDuration(rec)) return `${word} ?`; // dont know since when

    // show something even at 0m right after status change
    const dur = formatDuration(Date.now() - rec.statusSince);
    if (dur === "now" && !rec.preSession) return `${word}-now`;

    return `${word}-${dur}`;
}
