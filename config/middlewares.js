module.exports = [
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "http:", "https:"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "res.cloudinary.com",
            "dl.airtable.com",
            "strapi.io",
            "s3.amazonaws.com",
            "btrace.bukitasam.co.id", // TAMBAHKAN INI
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "res.cloudinary.com",
            "dl.airtable.com",
            "strapi.io",
            "s3.amazonaws.com",
            "btrace.bukitasam.co.id", // TAMBAHKAN INI
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      enabled: true,
      origin: [
        "http://localhost:4000",
        "http://localhost:5174",
        "http://192.168.1.83:5173",
        "http://192.168.1.185:1338",
        "http://192.168.43.188:5173",
        "https://b-trace.rehandling.my.id",
        "http://coal-tracking.my.id", 
        "http://156.67.220.12:3000",
        "https://btrace.bukitasam.co.id", 
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      headers: [
        "Access-Control-Allow-Origin", 
        "Content-Type",
        "Authorization",
        "Origin",
        "Accept",
        "x-api-version",
      ],
      keepHeaderOnError: true,
    },
  },
  "strapi::poweredBy",
  "strapi::logger",
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      formLimit: "5mb",
      jsonLimit: "256kb",
      textLimit: "256kb",
      formidable: {
        maxFileSize: 10 * 1024 * 1024, // 10MB — foto sudah dikompress ke ~300KB di FE
      },
    },
  },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];