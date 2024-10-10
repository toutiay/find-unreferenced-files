"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAssetMenu = exports.unload = exports.load = exports.methods = void 0;
const findUnreferencedFiles_1 = require("./findUnreferencedFiles");
const uuid_1 = require("./uuid");
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {};
/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
function load() { }
exports.load = load;
/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
function unload() { }
exports.unload = unload;
function onAssetMenu(assetInfo) {
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
                        let directoryPath = `${Editor.Project.path}/assets`;
                        let checkPath = [
                            `${directoryPath}/NoUi3`,
                            `${directoryPath}/sub`,
                        ];
                        (0, findUnreferencedFiles_1.findUnusedFiles)(directoryPath, checkPath, []);
                    },
                },
            ]
        }
    ];
}
exports.onAssetMenu = onAssetMenu;
async function checkUuid() {
    let scripts = await await Editor.Message.request('asset-db', 'query-assets', { pattern: "db://assets//**", importer: "typescript" });
    console.log(`start checkUuid ${scripts.length}`);
    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        let uuid = script.uuid;
        let compressUUID = Editor.Utils.UUID.compressUUID(script.uuid, false);
        let mycompressUUID = (0, uuid_1.encodeUuid)(uuid);
        console.log(`name: ${script.name} uuid: ${uuid} compressUUID: ${compressUUID} mycompressUUID: ${mycompressUUID}`);
        if (compressUUID != mycompressUUID) {
            console.error("uuid is not equal");
        }
    }
}
