import type { Tome } from "@notes/tome";

export async function renameCompanionFolder(
  tome: Tome,
  fromPath: string,
  toPath: string,
  folderForPath: (path: string) => string,
): Promise<void> {
  const fromFolder = folderForPath(fromPath);
  const toFolder = folderForPath(toPath);

  if (fromFolder === toFolder) {
    return;
  }

  if (await tome.exists(fromFolder)) {
    await tome.move(fromFolder, toFolder);
  }
}
