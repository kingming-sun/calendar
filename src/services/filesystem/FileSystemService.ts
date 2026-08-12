export function isFileSystemAccessSupported(): boolean {
  return "showDirectoryPicker" in window;
}

export class BrowserFileSystemService {
  async selectDirectory(): Promise<FileSystemDirectoryHandle> {
    if (!isFileSystemAccessSupported()) {
      throw new Error("当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge。");
    }

    return window.showDirectoryPicker({
      mode: "readwrite"
    });
  }

  async ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = {
      mode: "readwrite"
    };

    if ((await handle.queryPermission(options)) === "granted") {
      return true;
    }

    return (await handle.requestPermission(options)) === "granted";
  }

  async createDirectory(
    parent: FileSystemDirectoryHandle,
    name: string
  ): Promise<FileSystemDirectoryHandle> {
    return parent.getDirectoryHandle(name, {
      create: true
    });
  }

  async saveFile(
    directory: FileSystemDirectoryHandle,
    filename: string,
    blob: Blob
  ): Promise<File> {
    const fileHandle = await directory.getFileHandle(filename, {
      create: true
    });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    const savedFile = await fileHandle.getFile();
    if (savedFile.size <= 0) {
      throw new Error("文件写入后为空");
    }

    return savedFile;
  }

  async fileExists(
    directory: FileSystemDirectoryHandle,
    filename: string
  ): Promise<boolean> {
    try {
      const fileHandle = await directory.getFileHandle(filename);
      const file = await fileHandle.getFile();

      return file.size > 0;
    } catch {
      return false;
    }
  }
}

export const fileSystemService = new BrowserFileSystemService();
