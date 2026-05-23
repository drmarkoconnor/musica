"use client";

type FileSystemWritableFileStream = {
  close: () => Promise<void>;
  write: (data: Blob | BufferSource | string) => Promise<void>;
};

type FileSystemFileHandle = {
  createWritable: (options?: {
    keepExistingData?: boolean;
  }) => Promise<FileSystemWritableFileStream>;
  name: string;
};

type SaveFilePickerOptions = {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: Array<{
    accept: Record<string, string[]>;
    description: string;
  }>;
};

type WindowWithSaveFilePicker = Window &
  typeof globalThis & {
    showSaveFilePicker?: (
      options?: SaveFilePickerOptions,
    ) => Promise<FileSystemFileHandle>;
  };

export type DeviceRecordingBackup = {
  fileName: string;
  writable: FileSystemWritableFileStream;
};

export function deviceRecordingBackupSupported() {
  if (typeof window === "undefined") return false;

  return typeof (window as WindowWithSaveFilePicker).showSaveFilePicker === "function";
}

export async function createDeviceRecordingBackup({
  extension,
  mimeType,
  suggestedName,
}: {
  extension: string;
  mimeType: string;
  suggestedName: string;
}): Promise<DeviceRecordingBackup | null> {
  const picker = (window as WindowWithSaveFilePicker).showSaveFilePicker;

  if (!picker) return null;

  const fileName = `${suggestedName.replace(/\.[a-z0-9]+$/i, "")}.${extension}`;
  const handle = await picker({
    suggestedName: fileName,
    types: [
      {
        accept: {
          [mimeType || "audio/webm"]: [`.${extension}`],
        },
        description: "Lesson audio",
      },
    ],
  });

  return {
    fileName: handle.name,
    writable: await handle.createWritable({ keepExistingData: false }),
  };
}
