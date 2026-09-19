# Pocket Assistant

A phone-first assistant web app. Static files only, no server.

- **Offline:** calculator, unit converter, tasks, notes, timers, date and time.
- **Online:** an AI chat with your own API key. With Anthropic, it can also search the web.
- Each reply is tagged **on device** (green) or with the model name (blue).

## Put it on GitHub Pages

1. Create a GitHub repository and upload every file in this folder to the root.
2. Go to **Settings, Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
3. After a minute your app is live at `https://<username>.github.io/<repo>/`.
4. Open that link on your phone once with internet. Then use the browser menu, **Add to Home screen** (or **Install app**). After that it opens offline.

## Turn on the AI

Open **Setup** in the app and choose a provider, then enter the model name and your API key.

- **Anthropic** works with the default model name. Web search must be allowed in your Anthropic Console settings. If you see a tool error, check that setting.
- **Other providers** use OpenAI-style APIs. Check the provider's docs for the current model name, since these change. The base URL is filled in for you.

The key is stored only in your phone's browser. **Never put it in the code or the repository.** Use a key with a low spend limit.

## Commands that work offline

`12*(3+4)^2` · `calc sqrt(2)` · `convert 5 km to mi` · `100 c to f` · `note: idea` · `notes` · `todo: buy chalk` · `tasks` · `done 1` · `timer 10 min` · `remind me in 5 min to call` · `time` · `help`

## Limits

- Timers only ring while the app is open. Browsers pause pages in the background.
- Voice input uses your browser's speech service and needs internet.
- Trig functions use radians, and `%` is the remainder operator.

## Updating

After you change files, edit `V` in `sw.js` (for example to `v2`) so phones fetch the new version.
