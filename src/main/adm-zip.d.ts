declare module "adm-zip" {
  export default class AdmZip {
    constructor(path?: string);
    addLocalFile(localPath: string, zipPath?: string, zipName?: string): void;
    writeZip(targetFileName?: string): void;
  }
}
