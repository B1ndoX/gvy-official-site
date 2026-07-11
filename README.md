# GVY Official Site

Static site for the GVY official website. This is a separate production project from the Lantu blueprint site.

The formal production entry should be deployed through Tencent Cloud EdgeOne Pages / Makers at `www.gvyvoyagers.vip` and `gvyvoyagers.vip`.

Blueprint search belongs in the separate `gvy-lantu-site` project.

## Local Preview

```bash
npm run build
python3 -m http.server 8001 --directory dist
```

Open `http://127.0.0.1:8001/`.

## Build

`npm run build` creates a production-only `dist/` directory. `edgeone.json` configures Makers to publish that directory so repository documentation and build scripts are not exposed as site files.
