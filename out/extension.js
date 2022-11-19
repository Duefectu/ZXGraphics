"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const GDU_Editor_1 = require("./GDU_Editor");
function activate(context) {
    // Register our custom editor providers
    context.subscriptions.push(GDU_Editor_1.GDU_EditorProvider.register(context));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map