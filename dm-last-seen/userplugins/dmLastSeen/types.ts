/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type TrackableStatus = "online" | "idle" | "dnd" | "offline";

export function normalizeStatus(status: string | null | undefined): TrackableStatus {
    const s = typeof status === "string" ? status.toLowerCase() : "offline";
    if (s === "idle") return "idle";
    if (s === "dnd") return "dnd";
    if (s === "online") return "online";
    return "offline";
}
