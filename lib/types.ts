export type RepoInfo = {
  owner: string;
  repo: string;
  branch: string;
};

export type TreeEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeEntry[];
};

export type ComponentItem = {
  path: string;
  name: string;
};

export type ScanResult = {
  success: true;
  tree: TreeEntry[];
  list: ComponentItem[];
  repo: RepoInfo;
};

export type ScanError = {
  success: false;
  error: string;
};
