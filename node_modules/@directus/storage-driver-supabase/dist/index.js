// src/index.ts
import { normalizePath } from "@directus/utils";
import { StorageClient } from "@supabase/storage-js";
import { join } from "path";
import { Readable } from "stream";
import { fetch } from "undici";
var DriverSupabase = class {
  config;
  client;
  bucket;
  constructor(config) {
    this.config = {
      ...config,
      root: normalizePath(config.root ?? "", { removeLeading: true })
    };
    this.client = this.getClient();
    this.bucket = this.getBucket();
  }
  get endpoint() {
    return this.config.endpoint ?? `https://${this.config.projectId}.supabase.co/storage/v1`;
  }
  getClient() {
    if (!this.config.projectId && !this.config.endpoint) {
      throw new Error("`project_id` or `endpoint` is required");
    }
    if (!this.config.serviceRole) {
      throw new Error("`service_role` is required");
    }
    return new StorageClient(this.endpoint, {
      apikey: this.config.serviceRole,
      Authorization: `Bearer ${this.config.serviceRole}`
    });
  }
  getBucket() {
    if (!this.config.bucket) {
      throw new Error("`bucket` is required");
    }
    return this.client.from(this.config.bucket);
  }
  fullPath(filepath) {
    const path = join(this.config.root, filepath);
    if (path === ".")
      return "";
    return normalizePath(path);
  }
  getAuthenticatedUrl(filepath) {
    return `${this.endpoint}/${join("object/authenticated", this.config.bucket, this.fullPath(filepath))}`;
  }
  async read(filepath, range) {
    const requestInit = { method: "GET" };
    requestInit.headers = {
      Authorization: `Bearer ${this.config.serviceRole}`
    };
    if (range) {
      requestInit.headers["Range"] = `bytes=${range.start ?? ""}-${range.end ?? ""}`;
    }
    const response = await fetch(this.getAuthenticatedUrl(filepath), requestInit);
    if (response.status >= 400 || !response.body) {
      throw new Error(`No stream returned for file "${filepath}"`);
    }
    return Readable.fromWeb(response.body);
  }
  async stat(filepath) {
    const { data, error } = await this.bucket.list(this.config.root, {
      search: filepath,
      limit: 1
    });
    if (error || data.length === 0) {
      throw new Error("File not found");
    }
    return {
      size: data[0]?.metadata["contentLength"] ?? 0,
      modified: new Date(data[0]?.metadata["lastModified"] || null)
    };
  }
  async exists(filepath) {
    try {
      await this.stat(filepath);
      return true;
    } catch {
      return false;
    }
  }
  async move(src, dest) {
    await this.bucket.move(this.fullPath(src), this.fullPath(dest));
  }
  async copy(src, dest) {
    await this.bucket.copy(this.fullPath(src), this.fullPath(dest));
  }
  async write(filepath, content, type) {
    await this.bucket.upload(this.fullPath(filepath), content, {
      contentType: type ?? "",
      cacheControl: "3600",
      upsert: true,
      duplex: "half"
    });
  }
  async delete(filepath) {
    await this.bucket.remove([this.fullPath(filepath)]);
  }
  list(prefix = "") {
    const fullPrefix = this.fullPath(prefix);
    return this.listGenerator(fullPrefix);
  }
  async *listGenerator(prefix) {
    const limit = 1e3;
    let offset = 0;
    let itemCount = 0;
    const isDirectory = prefix.endsWith("/");
    const prefixDirectory = isDirectory ? prefix : dirname(prefix);
    const search = isDirectory ? "" : prefix.split("/").pop() ?? "";
    do {
      const { data, error } = await this.bucket.list(prefixDirectory, {
        limit,
        offset,
        search
      });
      if (!data || error) {
        break;
      }
      itemCount = data.length;
      offset += itemCount;
      for (const item of data) {
        const filePath = normalizePath(join(prefixDirectory, item.name));
        if (item.id !== null) {
          yield filePath.substring(this.config.root ? this.config.root.length + 1 : 0);
        } else {
          yield* this.listGenerator(`${filePath}/`);
        }
      }
    } while (itemCount === limit);
  }
};
var src_default = DriverSupabase;
function dirname(path) {
  return path.split("/").slice(0, -1).join("/");
}
export {
  DriverSupabase,
  src_default as default
};
