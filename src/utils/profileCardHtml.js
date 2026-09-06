const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { pathToFileURL } = require("url");

const HTML_PATH = path.join(__dirname, "..", "..", "profile-card.html");
const CARD_SELECTOR = "#card";
const PORT = 9876;

let browser = null;
let server = null;

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      fs.readFile(HTML_PATH, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Error loading profile card");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      });
    });

    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`[Profile] Local server running at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function getBrowser() {
  if (!browser) {
    server = await startLocalServer();
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
    });
  }
  return browser;
}

async function generateProfileCard(data) {
  try {
    const br = await getBrowser();
    const page = await br.newPage();
    const url = `http://127.0.0.1:${PORT}/`;

    await page.goto(url, { waitUntil: "load", timeout: 30000 });

    let avatarDataUrl = null;
    if (data.avatarUrl) {
      try {
        const avatarResponse = await fetch(data.avatarUrl, { signal: AbortSignal.timeout(8000) });
        if (avatarResponse.ok) {
          const arrayBuffer = await avatarResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = data.avatarUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          avatarDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        }
      } catch (e) {
        console.error("[Profile] Failed to fetch avatar:", e.message);
      }
    }

    const evalResult = await page.evaluate((data) => {
      try {
        const set = (id, value) => {
          const el = document.getElementById(id);
          if (el) el.value = value;
        };

        set("in-username", data.username);
        set("in-likes", String(data.likes));
        set("in-playlists", String(data.playlists));
        set("in-streams", String(data.streams));
        set("in-level", String(data.level));
        set("in-xp", String(data.xp));
        set("in-required", String(data.requiredXP));

        data.tracks.forEach((t, i) => {
          set(`t${i + 1}n`, t.n);
          set(`t${i + 1}d`, t.d);
        });

        data.servers.forEach((s, i) => {
          set(`s${i + 1}n`, s.n);
          set(`s${i + 1}d`, s.d);
        });

        data.friends.forEach((f, i) => {
          set(`f${i + 1}n`, f.n);
          set(`f${i + 1}d`, f.d);
        });

        if (data.avatarDataUrl) {
          const avatarBox = document.getElementById('avatarBox');
          if (avatarBox) {
            avatarBox.innerHTML = `<img src="${data.avatarDataUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`;
          }
        }

        if (typeof render === "function") render();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, { ...data, avatarDataUrl: avatarDataUrl });

    if (!evalResult.success) {
      console.error("[Profile] Page evaluation failed:", evalResult.error);
    }

    await new Promise((r) => setTimeout(r, 800));

    const card = await page.$(CARD_SELECTOR);
    if (!card) {
      const html = await page.content();
      console.error("[Profile] Card element not found. Page title:", await page.title());
      console.error("[Profile] HTML snippet:", html.slice(0, 500));
      await page.close();
      return null;
    }

    const cardBox = await card.boundingBox();
    console.log("[Profile] Card bounding box:", JSON.stringify(cardBox));

    let buffer;
    try {
      if (cardBox && cardBox.width > 0 && cardBox.height > 0) {
        buffer = await card.screenshot({ type: "jpeg", quality: 92 });
      } else {
        console.error("[Profile] Card has no size, falling back to full page clip");
        buffer = await page.screenshot({ type: "jpeg", quality: 92, clip: {
          x: 0,
          y: 0,
          width: 940,
          height: 630,
        }});
      }
    } catch (screenshotError) {
      console.error("[Profile] Screenshot failed:", screenshotError.message);
      await page.close();
      return null;
    }

    if (!buffer || (Buffer.isBuffer(buffer) && buffer.length === 0)) {
      console.error("[Profile] Screenshot returned empty buffer. Type:", buffer?.constructor?.name, "Length:", buffer?.length);
      await page.close();
      return null;
    }

    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }

    await page.close();
    return buffer;
  } catch (error) {
    console.error("[Profile] generateProfileCard error:", error.message, error.stack);
    throw error;
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

module.exports = { generateProfileCard, closeBrowser };
