// FILE: app/app.config.js — adds the "what's new" text to the app config, so it travels inside each published update
// and the in-app update sheet can show it. It comes from the notes typed on the Publish button (or `UPDATE_NOTES="..." eas update`).
// Everything else is still in app.json.
module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, updateNotes: process.env.UPDATE_NOTES || "" },
});
