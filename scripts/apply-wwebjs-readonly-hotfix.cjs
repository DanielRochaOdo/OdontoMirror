const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'node_modules', 'whatsapp-web.js', 'package.json');
const utilsPath = path.join(root, 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');

if (!fs.existsSync(packagePath) || !fs.existsSync(utilsPath)) {
  throw new Error('whatsapp-web.js não foi encontrado em node_modules. Execute npm install a partir da raiz do projeto.');
}

const installed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (installed.version !== '1.34.7') {
  throw new Error(`Hotfix read-only preparado para whatsapp-web.js 1.34.7, mas foi encontrada a versão ${installed.version}. Revise o hotfix antes de atualizar a biblioteca.`);
}

let source = fs.readFileSync(utilsPath, 'utf8');
let changed = false;

function replaceOnce(label, before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`Não foi possível aplicar o hotfix whatsapp-web.js (${label}). O código da dependência mudou.`);
  }
  source = source.replace(before, after);
  changed = true;
}

replaceOnce(
  'normalização do id da mensagem',
  `        if (typeof msg.id.remote === 'object') {
            msg.id = Object.assign({}, msg.id, {
                remote: msg.id.remote._serialized,
            });
        }

        delete msg.pendingAckUpdate;`,
  `        if (typeof msg.id.remote === 'object') {
            msg.id = Object.assign({}, msg.id, {
                remote: msg.id.remote._serialized,
            });
        }

        // WhatsApp Web 2.3000.104xxx pode expor o id serializado como \`$1\`.
        if (typeof msg.id === 'object' && msg.id._serialized == null) {
            const serializedId = window.WWebJS.getMsgKeyId(msg.id);
            if (serializedId) {
                msg.id = Object.assign({}, msg.id, {
                    _serialized: serializedId,
                });
            }
        }

        delete msg.pendingAckUpdate;`,
);

replaceOnce(
  'helper de id e isolamento de chats',
  `    window.WWebJS.getChats = async () => {
        const chats = window.require('WAWebCollections').Chat.getModelsArray();
        const chatPromises = chats.map((chat) =>
            window.WWebJS.getChatModel(chat),
        );
        return await Promise.all(chatPromises);
    };`,
  `    window.WWebJS.getMsgKeyId = (key) =>
        key?._serialized ?? key?.$1 ?? undefined;

    window.WWebJS.getChats = async () => {
        const chats = window.require('WAWebCollections').Chat.getModelsArray();
        const results = [];
        for (const chat of chats) {
            try {
                const model = await window.WWebJS.getChatModel(chat);
                if (model) results.push(model);
            } catch {
                // Um chat LID inválido não deve derrubar toda a sincronização.
            }
        }
        return results;
    };`,
);

replaceOnce(
  'fallback de metadata LID',
  `            await groupMetadata.update(chatWid);`,
  `            try {
                await groupMetadata.update(chatWid);
            } catch {
                // IDs LID podem não existir no índice local do WhatsApp Web.
                model.groupMetadata = null;
            }`,
);

replaceOnce(
  'lastReceivedKey compatível com $1',
  `            const lastMessage = chat.lastReceivedKey
                ? window
                      .require('WAWebCollections')
                      .Msg.get(chat.lastReceivedKey._serialized) ||
                  (
                      await window
                          .require('WAWebCollections')
                          .Msg.getMessagesById([
                              chat.lastReceivedKey._serialized,
                          ])
                  )?.messages?.[0]
                : null;`,
  `            const lastReceivedKeyId = window.WWebJS.getMsgKeyId(
                chat.lastReceivedKey,
            );
            const lastMessage = lastReceivedKeyId
                ? window
                      .require('WAWebCollections')
                      .Msg.get(lastReceivedKeyId) ||
                  (
                      await window
                          .require('WAWebCollections')
                          .Msg.getMessagesById([lastReceivedKeyId])
                  )?.messages?.[0]
                : null;`,
);

if (changed) {
  fs.writeFileSync(utilsPath, source, 'utf8');
  console.log('Hotfix read-only do whatsapp-web.js 1.34.7 aplicado com sucesso.');
} else {
  console.log('Hotfix read-only do whatsapp-web.js 1.34.7 já estava aplicado.');
}
