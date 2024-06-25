// src/index.ts
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { normalizePath } from "@directus/utils";
import { isReadableStream } from "@directus/utils/node";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { join } from "path";
var DriverS3 = class {
  config;
  client;
  root;
  constructor(config) {
    this.config = config;
    this.client = this.getClient();
    this.root = this.config.root ? normalizePath(this.config.root, { removeLeading: true }) : "";
  }
  getClient() {
    const connectionTimeout = 5e3;
    const socketTimeout = 12e4;
    const maxSockets = 500;
    const keepAlive = true;
    const s3ClientConfig = {
      requestHandler: new NodeHttpHandler({
        connectionTimeout,
        socketTimeout,
        httpAgent: new HttpAgent({ maxSockets, keepAlive }),
        httpsAgent: new HttpsAgent({ maxSockets, keepAlive })
      })
    };
    if (this.config.key && !this.config.secret || this.config.secret && !this.config.key) {
      throw new Error("Both `key` and `secret` are required when defined");
    }
    if (this.config.key && this.config.secret) {
      s3ClientConfig.credentials = {
        accessKeyId: this.config.key,
        secretAccessKey: this.config.secret
      };
    }
    if (this.config.endpoint) {
      const protocol = this.config.endpoint.startsWith("http://") ? "http:" : "https:";
      const hostname = this.config.endpoint.replace("https://", "").replace("http://", "");
      s3ClientConfig.endpoint = {
        hostname,
        protocol,
        path: "/"
      };
    }
    if (this.config.region) {
      s3ClientConfig.region = this.config.region;
    }
    if (this.config.forcePathStyle !== void 0) {
      s3ClientConfig.forcePathStyle = this.config.forcePathStyle;
    }
    return new S3Client(s3ClientConfig);
  }
  fullPath(filepath) {
    return normalizePath(join(this.root, filepath));
  }
  async read(filepath, range) {
    const commandInput = {
      Key: this.fullPath(filepath),
      Bucket: this.config.bucket
    };
    if (range) {
      commandInput.Range = `bytes=${range.start ?? ""}-${range.end ?? ""}`;
    }
    const { Body: stream } = await this.client.send(new GetObjectCommand(commandInput));
    if (!stream || !isReadableStream(stream)) {
      throw new Error(`No stream returned for file "${filepath}"`);
    }
    return stream;
  }
  async stat(filepath) {
    const { ContentLength, LastModified } = await this.client.send(
      new HeadObjectCommand({
        Key: this.fullPath(filepath),
        Bucket: this.config.bucket
      })
    );
    return {
      size: ContentLength,
      modified: LastModified
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
    await this.copy(src, dest);
    await this.delete(src);
  }
  async copy(src, dest) {
    const params = {
      Key: this.fullPath(dest),
      Bucket: this.config.bucket,
      CopySource: `/${this.config.bucket}/${this.fullPath(src)}`
    };
    if (this.config.serverSideEncryption) {
      params.ServerSideEncryption = this.config.serverSideEncryption;
    }
    if (this.config.acl) {
      params.ACL = this.config.acl;
    }
    await this.client.send(new CopyObjectCommand(params));
  }
  async write(filepath, content, type) {
    const params = {
      Key: this.fullPath(filepath),
      Body: content,
      Bucket: this.config.bucket
    };
    if (type) {
      params.ContentType = type;
    }
    if (this.config.acl) {
      params.ACL = this.config.acl;
    }
    if (this.config.serverSideEncryption) {
      params.ServerSideEncryption = this.config.serverSideEncryption;
    }
    const upload = new Upload({
      client: this.client,
      params
    });
    await upload.done();
  }
  async delete(filepath) {
    await this.client.send(new DeleteObjectCommand({ Key: this.fullPath(filepath), Bucket: this.config.bucket }));
  }
  async *list(prefix = "") {
    let Prefix = this.fullPath(prefix);
    if (Prefix === ".")
      Prefix = "";
    let continuationToken = void 0;
    do {
      const listObjectsV2CommandInput = {
        Bucket: this.config.bucket,
        Prefix,
        MaxKeys: 1e3
      };
      if (continuationToken) {
        listObjectsV2CommandInput.ContinuationToken = continuationToken;
      }
      const response = await this.client.send(new ListObjectsV2Command(listObjectsV2CommandInput));
      continuationToken = response.NextContinuationToken;
      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key)
            continue;
          const isDir = object.Key.endsWith("/");
          if (isDir)
            continue;
          yield object.Key.substring(this.root.length);
        }
      }
    } while (continuationToken);
  }
};
var src_default = DriverS3;
export {
  DriverS3,
  src_default as default
};
