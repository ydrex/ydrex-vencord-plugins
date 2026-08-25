/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RelationshipStore, TypingStore, UserStore } from "@webpack/common";

const startedAt = new Map<string, number>();

function key(channelId: string, userId: string) {
    return `${channelId}:${userId}`;
}

export function getLiveTypingIds(channelId: string | null | undefined) {
    if (!channelId) return [] as string[];

    const typing = TypingStore.getTypingUsers(channelId) ?? {};
    const me = UserStore.getCurrentUser()?.id;
    const ids: string[] = [];

    for (const id of Object.keys(typing)) {
        if (!id || id === me) continue;
        if (RelationshipStore.isBlocked(id)) continue;
        ids.push(id);
    }

    return ids;
}

export function getStartedAt(channelId: string, userId: string) {
    const k = key(channelId, userId);
    let t = startedAt.get(k);
    if (t == null) {
        t = Date.now();
        startedAt.set(k, t);
    }
    return t;
}

export function pruneChannel(channelId: string, liveIds: Set<string>) {
    const prefix = `${channelId}:`;
    for (const k of startedAt.keys()) {
        if (!k.startsWith(prefix)) continue;
        const userId = k.slice(prefix.length);
        if (!liveIds.has(userId)) startedAt.delete(k);
    }
}

export function clearAll() {
    startedAt.clear();
}

function formatDuration(ms: number) {
    if (ms < 0) ms = 0;

    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;

    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (mins < 60) return rem ? `${mins}m ${rem}s` : `${mins}m`;

    const hrs = Math.floor(mins / 60);
    const left = mins % 60;
    return left ? `${hrs}h ${left}m` : `${hrs}h`;
}

export function formatTypingTooltip(channelId: string) {
    const label = formatTypingLabel(channelId);
    if (!label) return undefined;
    return `typing for ${label}`;
}

export function formatTypingLabel(channelId: string) {
    const ids = getLiveTypingIds(channelId);
    if (!ids.length) return null;

    return ids.map(id => formatDuration(Date.now() - getStartedAt(channelId, id))).join(" / ");
}
