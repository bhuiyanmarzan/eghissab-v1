import type { ChatAttachment } from '../store/useChatStore';
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Attachment storage is unavailable.'));
      return;
    }
    const request = indexedDB.open('mantis-chat-attachments', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Attachment storage is unavailable.'));
  });
}
export async function saveChatAttachments(files: File[]): Promise<ChatAttachment[]> {
  if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE))
    throw new Error('Each attachment must be 10 MB or smaller.');
  const db = await database();
  try {
    const attachments = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      attachments.forEach((attachment, index) =>
        transaction.objectStore('files').put(files[index], attachment.id),
      );
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
    return attachments;
  } finally {
    db.close();
  }
}
export async function readChatAttachment(id: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function removeChatAttachment(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      transaction.objectStore('files').delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
