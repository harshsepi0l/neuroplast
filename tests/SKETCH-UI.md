# Mock UI browser regression checks

With Neuroplast running at `http://127.0.0.1:3000`, run:

```sh
node tests/sketch-ui.browser.mjs
```

The runner uses the existing `puppeteer-core` dependency and defaults to Brave on macOS. Set `BROWSER_PATH` to another Chromium executable and `BASE_URL` to a different app URL as needed.

Checks cover the actual home route, Home/Learn/Challenges/Knowledge/Sessions/Settings navigation, draft suggestion interaction, computed light/dark canvas colors, dot grid, selected yellow navigation, 2px composer stroke, Cascadia Mono, left-aligned layout, challenge-route availability, and mobile navigation/no horizontal overflow. Screenshots are written to ignored `test-results/`.

This test does not create a chat, call a model, or modify server-side settings. Theme screenshots toggle the document class only. The browser uses a temporary profile. It is intentionally separate from the Node-only `npm test` suite because it requires a running app and a browser.
