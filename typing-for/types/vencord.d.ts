/// <reference types="node" />

declare module "electron" {
    export interface IpcMainInvokeEvent {
        sender: unknown;
    }
}
