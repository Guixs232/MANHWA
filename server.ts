import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Endpoint to extract images from a web page (e.g., Webtoons)
  app.get("/api/extract-images", async (req, res) => {
    const pageUrl = req.query.url as string;
    const customSelector = req.query.selector as string;
    
    if (!pageUrl) return res.status(400).send("URL is required");

    try {
      const response = await axios.get(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Referer": new URL(pageUrl).origin,
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const images: string[] = [];

      // 1. Try custom selector if provided
      if (customSelector) {
        $(customSelector).each((_, el) => {
          const src = $(el).attr("data-src") || 
                      $(el).attr("data-lazy-src") || 
                      $(el).attr("data-original") || 
                      $(el).attr("src") ||
                      $(el).find("img").attr("src");
          if (src) images.push(src);
        });
      }

      // 2. Fallback to known site logic or generic logic
      if (images.length === 0) {
        if (pageUrl.includes("webtoons.com")) {
          $("#_imageList img").each((_, img) => {
            const src = $(img).attr("data-url") || $(img).attr("src");
            if (src && !src.includes("viewer_loading")) {
              images.push(src);
            }
          });
        } else {
          // Generic logic for other sites - check common lazy-loading attributes
          $("img").each((_, img) => {
            const src = $(img).attr("data-src") || 
                        $(img).attr("data-lazy-src") || 
                        $(img).attr("data-original") || 
                        $(img).attr("src");
            
            if (src) {
              images.push(src);
            }
          });
        }
      }

      // Clean and absolute URLs
      const cleanImages = images.map(src => {
        let absoluteUrl = src;
        if (src.startsWith("//")) {
          absoluteUrl = "https:" + src;
        } else if (src.startsWith("/")) {
          const urlObj = new URL(pageUrl);
          absoluteUrl = urlObj.origin + src;
        }
        return absoluteUrl;
      }).filter(src => 
        src.startsWith("http") && 
        !src.includes("logo") && 
        !src.includes("avatar") &&
        !src.includes("icon") &&
        !src.includes("banner")
      );

      res.json({ images: [...new Set(cleanImages)] });
    } catch (error: any) {
      console.error("Extraction error:", error.message);
      res.status(500).send(`Failed to extract images: ${error.message}`);
    }
  });

  // Proxy endpoint to fetch images and bypass CORS
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const url = new URL(imageUrl);
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Referer": url.origin,
          "Origin": url.origin,
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        timeout: 10000,
      });

      const contentType = response.headers["content-type"];
      if (!contentType?.startsWith("image/")) {
        console.warn(`Proxy warning: URL returned non-image content type: ${contentType}`);
      }
      
      res.set("Content-Type", contentType || "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(response.data);
    } catch (error: any) {
      console.error("Proxy error for URL:", imageUrl, error.message);
      res.status(500).send(`Failed to fetch image: ${error.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
