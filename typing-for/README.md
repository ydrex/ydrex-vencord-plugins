# vencord plugins

Where i put my public vencord userplugins. One folder per plugin under `userplugins/`.

Not official. Not affiliated with discord or vencord.

## plugins

| name | folder |
|------|--------|
| TypingFor | `userplugins/typingFor` |

## TypingFor

Gray text next to the typing bar above the chatbox. How long theyve been typing.

### what the text means

Discord doesnt tell you how long someone has been typing. The plugin counts from when the bar shows up while your discord is open.

**`12s` / `1m 20s`** they started this session. Example `12s` = typing about 12 seconds.

**`12s / 4s`** more than one person. Same order as the bar.

Discord resends typing every few seconds. The plugin keeps the first time so it doesnt jump back to `0s`.

### install

Turn off vencord auto update first (settings → vencord → updater → off).

You need [vencord from source](https://docs.vencord.dev/installing), pnpm, and this repo downloaded.

1. Run `deploy-vencord-plugins.bat`
2. Paste your vencord folder path when asked (folder with `package.json`)
3. Restart discord
4. Enable **TypingFor** in plugin settings

Data stays on your pc.

## license

GPL-3.0. See [LICENSE](LICENSE).
