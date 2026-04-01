// Skip Husky install in production and CI
if (process.env.NODE_ENV === "production" || process.env.CI === "true") {
  console.log("Skipping Husky in CI environment");
  process.exit(0);
} else {
  const husky = (await import("husky")).default;
  console.log(husky());
}
