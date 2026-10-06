import { S3Client } from "bun";
import { env } from "../lib/env";

export type StorageData = Parameters<S3Client["write"]>[1];
export enum StorageBucket {
  Media = "arona-media",
}

export default class StorageService {
  private static readonly clients: Map<StorageBucket, S3Client> = new Map<StorageBucket, S3Client>(
    Object.values(StorageBucket).map(
      bucket =>
        [
          bucket,
          new S3Client({
            accessKeyId: env.S3_ACCESS_KEY,
            secretAccessKey: env.S3_SECRET_KEY,
            region: env.S3_REGION,
            endpoint: env.S3_ENDPOINT,
            bucket: bucket,
          }),
        ] as const
    )
  );

  private static clientFor(bucket: StorageBucket): S3Client {
    const client = StorageService.clients.get(bucket);
    if (!client) {
      throw new Error(`No storage client configured for bucket "${bucket}"`);
    }
    return client;
  }

  public static async init(): Promise<void> {
    for (const [bucket, client] of StorageService.clients) {
      try {
        await client.list({ maxKeys: 1 }, { bucket: bucket });
      } catch (error) {
        console.warn(`Storage bucket not accessible: ${bucket} (${error})`);
      }
    }
  }

  public static async saveFile(
    bucket: StorageBucket,
    filename: string,
    data: StorageData,
    contentType?: string
  ): Promise<boolean> {
    try {
      await StorageService.clientFor(bucket).write(filename, data, { type: contentType });
      return true;
    } catch (error) {
      console.error(`Failed to save file to storage: ${bucket}/${filename} (${error})`);
      return false;
    }
  }

  public static async getFile(bucket: StorageBucket, filename: string): Promise<Buffer | undefined> {
    try {
      return Buffer.from(await StorageService.clientFor(bucket).file(filename).arrayBuffer());
    } catch {
      return undefined;
    }
  }

  public static async fileExists(bucket: StorageBucket, filename: string): Promise<boolean> {
    try {
      return await StorageService.clientFor(bucket).exists(filename);
    } catch {
      return false;
    }
  }

  public static async deleteFile(bucket: StorageBucket, filename: string): Promise<void> {
    try {
      await StorageService.clientFor(bucket).delete(filename);
    } catch (error) {
      console.error(`Failed to delete file from storage: ${bucket}/${filename} (${error})`);
    }
  }

  public static getPublicUrl(bucket: StorageBucket, filename: string): string {
    const base = env.S3_PUBLIC_URL.replace(/\/+$/, "");
    return `${base}/${bucket}/${filename.replace(/^\/+/, "")}`;
  }
}
