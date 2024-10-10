import { AssetInfo } from "../@types/packages/asset-db/@types/public";
import { findUnusedFiles } from "./findUnreferencedFiles";
import { encodeUuid } from "./uuid";

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {

};

/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
export function load() { }

/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
export function unload() { }

export function onAssetMenu(assetInfo: AssetInfo) {
    return [
        {
            label: "功能",
            submenu: [
                {
                    label: '打开collect_spriteFrame_info',
                    enabled: assetInfo.importer == "sprite-atlas",
                    async click() {
                        console.log(assetInfo);
                        console.log(await Editor.Message.request('asset-db', 'query-asset-info', (assetInfo.uuid)));
                        Editor.Message.request('asset-db', 'open-asset', ("1a6e9519-73e3-420a-9979-9131d8a10ae0"));
                    },
                },
                {
                    label: '校验uuid压缩方法',
                    enabled: true,
                    click() {
                        console.log(assetInfo);
                        console.log(assetInfo.uuid, Editor.Utils.UUID.compressUUID(assetInfo.uuid, false));
                        checkUuid();
                    },
                },
                {
                    label: '检查未使用的ts文件',
                    enabled: true,
                    click() {
                        let directoryPath: string = `${Editor.Project.path}/assets`;
                        let checkPath: string[] = [
                            `${directoryPath}/NoUi3`,
                            `${directoryPath}/sub`,
                        ];
                        findUnusedFiles(directoryPath, checkPath, []);
                    },
                },
            ]
        }
    ]
}

async function checkUuid() {
    let scripts: AssetInfo[] = await await Editor.Message.request('asset-db', 'query-assets', { pattern: "db://assets//**", importer: "typescript" });
    console.log(`start checkUuid ${scripts.length}`);
    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        let uuid = script.uuid;
        let compressUUID = Editor.Utils.UUID.compressUUID(script.uuid, false);
        let mycompressUUID = encodeUuid(uuid);
        console.log(`name: ${script.name} uuid: ${uuid} compressUUID: ${compressUUID} mycompressUUID: ${mycompressUUID}`);
        if (compressUUID != mycompressUUID) {
            console.error("uuid is not equal");
        }
    }
}