export async function register() {
  if (process.env.DEV_LOGIN_ENABLED === "true") {
    const { neonConfig } = await import("@neondatabase/serverless");
    neonConfig.fetchEndpoint = () => "http://db.localtest.me:4444/sql";
  }
}
