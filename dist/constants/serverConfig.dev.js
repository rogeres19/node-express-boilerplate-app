"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./env");
exports.devServerConfig = {
    app: {
        name: env_1.appName,
        port: 3000,
        url: 'http://localhost:3000/',
        mongodbConnectionUrl: 'mongodb://mongo:27017/app'
    },
    email: {
        supportEmail: env_1.supportEmail,
        sendGridAPIKey: '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',
        templatesFolder: './src/emails/templates',
        globalTemplateVars: {
            'Product Name': env_1.appName,
            'Sender Name': 'Joao',
            'Company Name, LLC': 'App Boilerplate Inc',
            'Company Address': '1234, Street Rd. Suite 1234'
        }
    },
    env: 'dev',
    maintenanceMode: false,
    language: 'eng',
    jwtSecret: 'pez9SHY+4By+ce4PFMevcg=='
};
