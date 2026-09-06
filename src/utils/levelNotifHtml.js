const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const http = require("http");

const HTML_PATH = path.join(__dirname, "..", "..", "level-notif.html");
const CARD_SELECTOR = "#card";
const PORT = 9878;

let browser = null;
let server = null;

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      fs.readFile(HTML_PATH, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Error loading level notification");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      });
    });

    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`[LevelNotif] Local server running at http://127.0.0.1:${PORT}`);
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

async function generateLevelNotif(data) {
  try {
    const br = await getBrowser();
    const page = await br.newPage();
    const url = `http://127.0.0.1:${PORT}/`;

    await page.setViewport({ width: 300, height: 150, deviceScaleFactor: 2 });
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
        console.error("[LevelNotif] Failed to fetch avatar:", e.message);
      }
    }

    const evalResult = await page.evaluate((data) => {
      try {
        const set = (id, value) => {
          const el = document.getElementById(id);
          if (el) el.value = value;
        };

        set("nameInput", data.username);
        set("levelInput", String(data.level));

        if (data.avatarDataUrl) {
          const avatarImg = document.getElementById('avatarImg');
          if (avatarImg) {
            avatarImg.src = data.avatarDataUrl;
          }
        }

        if (typeof render === "function") render();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, { ...data, avatarDataUrl: avatarDataUrl });

    if (!evalResult.success) {
      console.error("[LevelNotif] Page evaluation failed:", evalResult.error);
    }

    await new Promise((r) => setTimeout(r, 500));

    const card = await page.$(CARD_SELECTOR);
    if (!card) {
      const html = await page.content();
      console.error("[LevelNotif] Card element not found. Page title:", await page.title());
      console.error("[LevelNotif] HTML snippet:", html.slice(0, 500));
      await page.close();
      return null;
    }

    const cardBox = await card.boundingBox();
    console.log("[LevelNotif] Card bounding box:", JSON.stringify(cardBox));

    let buffer;
    try {
      if (cardBox && cardBox.width > 0 && cardBox.height > 0) {
        buffer = await card.screenshot({ type: "png" });
      } else {
        console.error("[LevelNotif] Card has no size, falling back to full page clip");
        buffer = await page.screenshot({ type: "png", clip: {
          x: 0,
          y: 0,
          width: 260,
          height: 100,
        }});
      }
    } catch (screenshotError) {
      console.error("[LevelNotif] Screenshot failed:", screenshotError.message);
      await page.close();
      return null;
    }

    if (!buffer || (Buffer.isBuffer(buffer) && buffer.length === 0)) {
      console.error("[LevelNotif] Screenshot returned empty buffer.");
      await page.close();
      return null;
    }

    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }

    await page.close();
    return buffer;
  } catch (error) {
    console.error("[LevelNotif] generateLevelNotif error:", error.message, error.stack);
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

module.exports = { generateLevelNotif, closeBrowser };
