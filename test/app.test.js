const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const http = require("node:http");
const app = require("../index.js");

function makeRequest(port, path, method = "GET", payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: body
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            }
          : undefined,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      },
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

test("admin login works without a configured MongoDB URI", async () => {
  const server = app.listen(0);
  await once(server, "listening");

  try {
    const port = server.address().port;
    const response = await makeRequest(port, "/api/admin/login", "POST", {
      username: "admin",
      password: "admin123",
    });

    assert.equal(response.statusCode, 200, response.body);
    const json = JSON.parse(response.body);
    assert.equal(json.success, true);
  } finally {
    server.close();
  }
});
