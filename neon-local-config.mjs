import { neonConfig } from "@neondatabase/serverless";

neonConfig.fetchEndpoint = () => "http://db.localtest.me:4444/sql";
