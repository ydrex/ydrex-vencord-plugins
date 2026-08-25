/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import {
    React,
    ReactDOM,
    SelectedChannelStore,
    TypingStore,
    UserStore,
    createRoot,
    useEffect,
    useState,
    useStateFromStores
} from "@webpack/common";

import {
    clearAll,
    formatTypingLabel,
    formatTypingTooltip,
    getLiveTypingIds,
    pruneChannel
} from "./store";

function getTypingBar() {
    const area = document.querySelector("[class*='channelTextArea']");
    const root = area?.closest("form") ?? area?.parentElement?.parentElement ?? document.body;

    for (const svg of root.querySelectorAll("svg[aria-hidden='true']")) {
        if (svg.querySelectorAll("circle").length < 3) continue;
        const bar = svg.parentElement;
        if (bar instanceof HTMLElement) return bar;
    }

    return null;
}

function TypingTag({ channel }: { channel?: Channel | null; }) {
    const [, bump] = useState(0);

    const channelId = useStateFromStores(
        [SelectedChannelStore],
        () => channel?.id ?? SelectedChannelStore.getChannelId() ?? null
    );

    const ids = useStateFromStores(
        [TypingStore, UserStore],
        () => getLiveTypingIds(channelId),
        null,
        (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
    );

    // drop people who stopped or the next start would keep the old time
    if (channelId) pruneChannel(channelId, new Set(ids));

    const label = channelId ? formatTypingLabel(channelId) : null;

    useEffect(() => {
        if (!label) return;
        const t = setInterval(() => bump(n => n + 1), 1000);
        return () => clearInterval(t);
    }, [channelId, label]);

    if (!label) return null;

    return (
        <span className="vc-typing-for" title={formatTypingTooltip(channelId!)}>
            {label}
        </span>
    );
}

function TypingBarInfo() {
    const [bar, setBar] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const sync = () => {
            const el = getTypingBar();
            if (!el) {
                setBar(null);
                return;
            }
            if (el.querySelector(".vc-typing-for")) return;
            setBar(el);
        };

        sync();
        const mo = new MutationObserver(sync);
        mo.observe(document.body, { childList: true, subtree: true });
        return () => mo.disconnect();
    }, []);

    if (!bar) return null;
    return ReactDOM.createPortal(React.createElement(TypingTag), bar);
}

export default definePlugin({
    name: "TypingFor",
    description: "how long theyve been typing, next to the bar above the chatbox",
    authors: [{ name: "selxxet", id: 0n }],

    patches: [
        {
            find: "#{intl::SEVERAL_USERS_TYPING_STRONG}",
            replacement: {
                match: /("aria-hidden":!0,children:\i}\))/,
                replace: "$1,$self.getTypingElement(arguments[0])",
                noWarn: true
            }
        }
    ],

    getTypingElement(props: { channel?: Channel | null; } | null | undefined) {
        return React.createElement(this.TypingInfo, { key: "vc-typing-for", channel: props?.channel });
    },

    TypingInfo: ErrorBoundary.wrap(TypingTag, { noop: true }),
    TypingBarInfo: ErrorBoundary.wrap(TypingBarInfo, { noop: true }),

    host: null as HTMLDivElement | null,
    root: null as ReturnType<typeof createRoot> | null,

    start() {
        const host = document.createElement("div");
        document.body.appendChild(host);
        this.host = host;
        this.root = createRoot(host);
        this.root.render(React.createElement(this.TypingBarInfo));
    },

    stop() {
        this.root?.unmount();
        this.root = null;
        this.host?.remove();
        this.host = null;
        clearAll();
    }
});
