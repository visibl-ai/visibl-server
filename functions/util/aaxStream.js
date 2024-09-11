import fetch from "node-fetch";
import logger from "../util/logger.js";

const streamAax = async (req, res) => {
  try {
    const url = "https://firebasestorage.googleapis.com/v0/b/visibl-dev-ali.appspot.com/o/Catalogue%2FProcessed%2FVISIBL_000001%2FVISIBL_000001-ch3.m4a?alt=media&token=01b2d5c1-cfbb-4d17-8499-40d0eda5e0a3"; // Replace with your actual target URL

    // Forward the original request headers
    const headers = {...req.headers};
    delete headers.host; // Remove the 'host' header as it will be set by fetch
    delete headers["x-forwarded-host"];
    delete headers["x-original-url"];
    delete headers.connection;
    // Ensure the 'range' header is forwarded if present
    if (headers.range) {
      headers.Range = headers.range;
      delete headers.range;
    }
    logger.debug(`METHOD: ${req.method}`);
    logger.debug(`HEADERS: ${JSON.stringify(headers)}`);
    const response = await fetch(url, {
      method: req.method,
      headers: headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });

    // Log the response details
    logger.debug(`Response status: ${response.status}`);
    logger.debug(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);

    // If you want to log the body for non-streaming responses:
    let bodyText;
    if (!response.body.pipe) {
      bodyText = await response.text();
      logger.debug(`Response body: ${bodyText}`);
    }

    // Set the status code and headers from the proxied response
    res.status(response.status);
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    // Pipe the response body to the client
    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      res.send(bodyText);
    }
  } catch (error) {
    logger.error("Error proxying request:", error);
    res.status(500).send("Internal Server Error");
  }
};

const demoOPDS = async (req, res) => {
  res.json({
    "metadata": {
      "title": "Visibl Catalog",
    },
    "publications": [
      {
        "metadata": {
          "@type": "http://schema.org/Audiobook",
          "title": "AAX DEMO",
          "author": [
            "MOE ADHAM",
          ],
          "identifier": "VISIBL_000001",
          "language": "en",
          "published": "2021-07-13",
          "description": "The sky above the port was the colour of television, tuned to a dead channel....",
          "duration": 3196,
          "visiblId": "47E2xaFuV0iRXzMJCzFK",
        },
        "images": [
          {
            "href": "https://firebasestorage.googleapis.com/v0/b/visibl-dev-ali.appspot.com/o/Catalogue%2FProcessed%2FVISIBL_000001%2FVISIBL_000001.jpg?alt=media&token=b65c29ad-e913-4605-9b16-5341e815242f",
            "type": "image/jpeg",
          },
        ],
        "links": [
          {
            "href": "http://localhost:5002/v1/aax/demoManifest",
            "type": "application/audiobook+json",
            "rel": "http://opds-spec.org/acquisition/buy",
          },
        ],
      },
    ],
  });
};

const demoManifest = async (req, res) => {
  res.json({
    "@context": "https://readium.org/webpub-manifest/context.jsonld",
    "metadata": {
      "@type": "http://schema.org/Audiobook",
      "title": "Neuromancer: Sprawl Trilogy, Book 1",
      "author": [
        "William Gibson",
      ],
      "identifier": "VISIBL_000001",
      "language": "en",
      "published": "2021-07-13",
      "description": "The sky above the port was the colour of television, tuned to a dead channel....",
      "duration": 3196,
      "visiblId": "47E2xaFuV0iRXzMJCzFK",
    },
    "links": [
      {
        "href": "https://firebasestorage.googleapis.com/v0/b/visibl-dev-ali.appspot.com/o/Catalogue%2FProcessed%2FVISIBL_000001%2FVISIBL_000001.jpg?alt=media&token=b65c29ad-e913-4605-9b16-5341e815242f",
        "type": "image/jpeg",
        "rel": "cover",
      },
    ],
    "readingOrder": [
      {
        "type": "audio/mp4",
        "duration": 3196,
        "title": "AAX DEMO",
        "href": "http://localhost:5002/v1/aax/stream",
      },
    ],
  });
};

const streamAaxFfmpeg = async (req, res) => {
  try {
    logger.debug("New request to streamAaxFfmpeg");
    const url = "http://127.0.0.1:8089/";

    // Forward the original request headers for non-HEAD requests
    const headers = {...req.headers};
    delete headers.host; // Remove the 'host' header as it will be set by fetch
    delete headers["x-forwarded-host"];
    delete headers["x-original-url"];
    delete headers.connection;

    // Ensure the 'range' header is forwarded if present
    if (headers.range) {
      headers.Range = headers.range;
      delete headers.range;
    }
    logger.debug(`METHOD: ${req.method}`);
    logger.debug(`HEADERS: ${JSON.stringify(headers)}`);

    // Handle HEAD request separately
    if (req.method === "HEAD") {
      logger.debug("Handling HEAD request");

      // Here we respond with the correct headers for the content.
      res.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Type": "audio/aac", // Correct content type for ADTS-wrapped AAC
        "Connection": "close",
        "Content-Length": "25974816", // Omit or dynamically calculate if static file
        "Cache-Control": "private, max-age=0",
        "Date": new Date().toUTCString(),
        "Server": "FFmpeg-Server",
      });

      res.end(); // End the response without sending a body
    } else {
      const response = await fetch(url, {headers, method: req.method});

      // Forward the response status and headers to the client
      res.writeHead(response.status, {
        ...response.headers.raw(),
        "Access-Control-Allow-Origin": "*", // Enable CORS if needed
      });

      // Ensure the body is piped correctly
      response.body.pipe(res);

      // Handle any errors in the stream
      response.body.on("error", (err) => {
        logger.error("Error while piping the response body:", err);
        res.end(); // Ensure the response is closed properly
      });

      // Handle the end of the stream gracefully
      response.body.on("end", () => {
        logger.debug("Stream ended");
        res.end(); // Close the response properly when the stream ends
      });
    }
  } catch (error) {
    logger.error("Error proxying request:", error);
    res.status(500).send("Internal Server Error");
  }
};

export {streamAax, demoOPDS, demoManifest, streamAaxFfmpeg};
