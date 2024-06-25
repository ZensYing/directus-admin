// src/index.ts
import { normalizePath } from "@directus/utils";
import { Storage } from "@google-cloud/storage";
import { join } from "path";
import { pipeline } from "stream/promises";
var DriverGCS = class {
  root;
  bucket;
  constructor(config) {
    const { bucket, root, ...storageOptions } = config;
    this.root = root ? normalizePath(root, { removeLeading: true }) : "";
    const storage = new Storage(storageOptions);
    this.bucket = storage.bucket(bucket);
  }
  fullPath(filepath) {
    return normalizePath(join(this.root, filepath));
  }
  file(filepath) {
    return this.bucket.file(filepath);
  }
  async read(filepath, range) {
    const options = {};
    if (range?.start)
      options.start = range.start;
    if (range?.end)
      options.end = range.end;
    return this.file(this.fullPath(filepath)).createReadStream(options);
  }
  async write(filepath, content) {
    const file = this.file(this.fullPath(filepath));
    const stream = file.createWriteStream({ resumable: false });
    await pipeline(content, stream);
  }
  async delete(filepath) {
    await this.file(this.fullPath(filepath)).delete();
  }
  async stat(filepath) {
    const [{ size, updated }] = await this.file(this.fullPath(filepath)).getMetadata();
    return { size, modified: new Date(updated) };
  }
  async exists(filepath) {
    return (await this.file(this.fullPath(filepath)).exists())[0];
  }
  async move(src, dest) {
    await this.file(this.fullPath(src)).move(this.file(this.fullPath(dest)));
  }
  async copy(src, dest) {
    await this.file(this.fullPath(src)).copy(this.file(this.fullPath(dest)));
  }
  async *list(prefix = "") {
    let query = {
      prefix: this.fullPath(prefix),
      autoPaginate: false,
      maxResults: 500
    };
    while (query) {
      const [files, nextQuery] = await this.bucket.getFiles(query);
      for (const file of files) {
        yield file.name.substring(this.root.length);
      }
      query = nextQuery;
    }
  }
};
var src_default = DriverGCS;
export {
  DriverGCS,
  src_default as default
};
