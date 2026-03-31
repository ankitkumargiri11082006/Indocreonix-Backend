import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./env.js";

function configureDnsResolvers() {
  const resolverSource =
    process.env.MONGODB_DNS_SERVERS || "0.0.0.0,1.1.1.1,8.8.8.8";
  const candidateServers = resolverSource
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // 0.0.0.0 is a bind/listen wildcard and not a real DNS resolver address.
  const dnsServers = candidateServers.filter((server) => server !== "0.0.0.0");
  if (!dnsServers.length) {
    return;
  }

  dns.setServers(dnsServers);
  // eslint-disable-next-line no-console
  console.log(`🌐 DNS resolvers: ${dnsServers.join(", ")}`);
}

export async function connectDatabase() {
  configureDnsResolvers();
  await mongoose.connect(env.mongoUri);
  // eslint-disable-next-line no-console
  console.log("✅ MongoDB connected");
}
