import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext build for Cloudflare Workers. Every page is dynamic (it depends on
 * the Host header and a cookie), so there is nothing to cache incrementally
 * and no tag cache or revalidation queue to wire up.
 */
export default defineCloudflareConfig({});
