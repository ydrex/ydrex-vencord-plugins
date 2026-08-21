# vencord plugins

Where i put my public vencord userplugins. One folder per plugin under `userplugins/`.

Not official. Not affiliated with discord or vencord.

Right now only dm last seen is here. Might add more later.

## plugins

| name | folder |
|------|--------|
| DmLastSeen | `userplugins/dmLastSeen` |

## DmLastSeen

Gray text next to dm names. Online, idle, or last seen.

### what the text means

Discord doesnt tell you "offline since 2 hours ago". The plugin only counts when someones status changes while your discord is open.

**`?`** status known, time unknown. Example `last seen ?`. Hover shows "duration unknown".

**`-4m` / `-2h` / `-now`** you saw the switch this session. Example `on-4m` = online about 4 minutes.

### install

Turn off vencord auto update first (settings → vencord → updater → off).

You need [vencord from source](https://docs.vencord.dev/installing), pnpm, and this repo downloaded.

1. Run `deploy-vencord-plugins.bat`
2. Paste your vencord folder path when asked (folder with `package.json`)
3. Restart discord
4. Enable **DmLastSeen** in plugin settings

Dms only. Data stays on your pc.

## license

GPL-3.0. See [LICENSE](LICENSE).
