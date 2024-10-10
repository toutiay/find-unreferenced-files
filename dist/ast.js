"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWindowUsage = exports.handleTypeScriptJavaScriptAST = exports.handleJavaScriptAST = void 0;
const typescript_1 = __importDefault(require("typescript"));
const parser_1 = require("@babel/parser");
const types_1 = require("@babel/types");
const traverse_1 = __importDefault(require("@babel/traverse"));
const tools_1 = require("./tools");
// 控制是否启用AST日志记录
const ENABLE_AST_LOGGING = true;
/**
 * 如果启用了AST日志，则记录消息
 * @param message 要记录的消息
 */
function astLog(message) {
    if (ENABLE_AST_LOGGING) {
        console.log(message);
    }
}
/**
 * 更新文件映射中的导入信息
 * @param fileMap 所有文件的映射
 * @param importingFile 进行导入的文件
 * @param importedFile 被导入的文件
 */
function updateFileMap(fileMap, importingFile, importedFile) {
    if (fileMap.has(importedFile)) {
        fileMap.get(importedFile).beImportList.add(importingFile);
    }
    if (fileMap.has(importingFile)) {
        fileMap.get(importingFile).importList.add(importedFile);
    }
}
/**
 * 处理JavaScript或TypeScript中的导入
 * @param fileMap 所有文件的映射
 * @param filePath 包含导入的文件的路径
 * @param importPath 被导入文件的路径
 */
function handleImport(fileMap, filePath, importPath) {
    const resolvedImportPath = (0, tools_1.resolveImportPath)(filePath, importPath);
    astLog(`    ${resolvedImportPath}`);
    if (resolvedImportPath != null) {
        updateFileMap(fileMap, filePath, resolvedImportPath);
    }
}
/**
 * 解析JavaScript文件并提取导入信息
 * @param filePath 要解析的文件路径
 * @param fileInfo 文件信息
 * @param fileMap 所有文件的映射
 */
function handleJavaScriptAST(filePath, fileInfo, fileMap) {
    astLog(`>>> 正在解析JavaScript AST: ${filePath}`);
    const ast = (0, parser_1.parse)(fileInfo.content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators', 'classProperties'],
    });
    (0, traverse_1.default)(ast, {
        ImportDeclaration({ node }) {
            handleImport(fileMap, filePath, node.source.value);
        },
        CallExpression({ node }) {
            if ((0, types_1.isIdentifier)(node.callee, { name: 'require' }) || (0, types_1.isImport)(node.callee)) {
                handleImport(fileMap, filePath, node.arguments[0].value);
            }
        },
    });
}
exports.handleJavaScriptAST = handleJavaScriptAST;
/**
 * 解析TypeScript文件并提取导入信息
 * @param filePath 要解析的文件路径
 * @param fileInfo 文件信息
 * @param fileMap 所有文件的映射
 */
function handleTypeScriptJavaScriptAST(filePath, fileInfo, fileMap) {
    astLog(`>>> 正在解析TypeScript/JavaScript AST: ${filePath}`);
    const sourceFile = typescript_1.default.createSourceFile(filePath, fileInfo.content, typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    typescript_1.default.forEachChild(sourceFile, node => {
        if (typescript_1.default.isImportDeclaration(node) && typescript_1.default.isStringLiteral(node.moduleSpecifier)) {
            handleImport(fileMap, filePath, node.moduleSpecifier.text);
        }
    });
}
exports.handleTypeScriptJavaScriptAST = handleTypeScriptJavaScriptAST;
/**
 * 进行window.abc=def或者使用window.abc的检查
 * @param filePath
 * @param fileInfo
 * @returns
 */
function checkWindowUsage(filePath, fileInfo) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, fileInfo.content, typescript_1.default.ScriptTarget.Latest, true);
    const result = {
        assignments: [],
        references: [],
        destructured: [],
        functionCalls: [],
        aliases: [],
        passedAsArgument: [],
        prototypeExtensions: [],
        conditionalChecks: []
    };
    function visit(node) {
        if (typescript_1.default.isBinaryExpression(node) && node.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken) {
            if (typescript_1.default.isPropertyAccessExpression(node.left) && typescript_1.default.isIdentifier(node.left.expression) && node.left.expression.text === 'window') {
                result.assignments.push({ type: 'static', key: node.left.name.text });
            }
            else if (typescript_1.default.isElementAccessExpression(node.left) && typescript_1.default.isIdentifier(node.left.expression) && node.left.expression.text === 'window') {
                const key = node.left.argumentExpression.getText(sourceFile);
                result.assignments.push({ type: 'dynamic', key });
            }
        }
        else if (typescript_1.default.isPropertyAccessExpression(node) && typescript_1.default.isIdentifier(node.expression) && node.expression.text === 'window') {
            if (!typescript_1.default.isBinaryExpression(node.parent) || node.parent.left !== node) {
                result.references.push({ type: 'static', key: node.name.text });
            }
        }
        else if (typescript_1.default.isElementAccessExpression(node) && typescript_1.default.isIdentifier(node.expression) && node.expression.text === 'window') {
            if (!typescript_1.default.isBinaryExpression(node.parent) || node.parent.left !== node) {
                const key = node.argumentExpression.getText(sourceFile);
                result.references.push({ type: 'dynamic', key });
            }
        }
        else if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isObjectBindingPattern(node.name) &&
            node.initializer && typescript_1.default.isIdentifier(node.initializer) && node.initializer.text === 'window') {
            node.name.elements.forEach(element => {
                if (typescript_1.default.isIdentifier(element.name)) {
                    result.destructured.push(element.name.text);
                }
            });
        }
        else if (typescript_1.default.isCallExpression(node) && typescript_1.default.isPropertyAccessExpression(node.expression) &&
            typescript_1.default.isIdentifier(node.expression.expression) && node.expression.expression.text === 'window') {
            result.functionCalls.push(node.expression.name.text);
        }
        else if (typescript_1.default.isCallExpression(node)) {
            node.arguments.forEach((arg, index) => {
                if (typescript_1.default.isIdentifier(arg) && arg.text === 'window') {
                    const functionName = typescript_1.default.isIdentifier(node.expression) ? node.expression.text : 'anonymous';
                    result.passedAsArgument.push({ functionName, argumentIndex: index });
                }
            });
        }
        else if (typescript_1.default.isVariableDeclaration(node) && node.initializer &&
            typescript_1.default.isIdentifier(node.initializer) && node.initializer.text === 'window' &&
            typescript_1.default.isIdentifier(node.name)) {
            result.aliases.push(node.name.text);
        }
        else if (typescript_1.default.isBinaryExpression(node) && node.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken &&
            typescript_1.default.isPropertyAccessExpression(node.left) && typescript_1.default.isPropertyAccessExpression(node.left.expression) &&
            typescript_1.default.isIdentifier(node.left.expression.expression) && node.left.expression.expression.text === 'window' &&
            typescript_1.default.isIdentifier(node.left.expression.name) && node.left.expression.name.text === 'prototype') {
            result.prototypeExtensions.push(node.left.name.text);
        }
        else if (typescript_1.default.isIfStatement(node) && typescript_1.default.isPropertyAccessExpression(node.expression) &&
            typescript_1.default.isIdentifier(node.expression.expression) && node.expression.expression.text === 'window') {
            result.conditionalChecks.push(node.expression.name.text);
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return result;
}
exports.checkWindowUsage = checkWindowUsage;
