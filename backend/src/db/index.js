import mongoose from 'mongoose';

export function now() {
  return Date.now();
}

function toRow(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  o.id = o._id;
  return o;
}

const addressSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  local_part: { type: String, required: true },
  domain: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  access_key_hash: { type: String, required: true },
  access_key_hint: { type: String, required: true },
  created_at: { type: Number, required: true },
  last_access: { type: Number, default: null },
  is_active: { type: Boolean, default: true },
}, { versionKey: false });

const sessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  address_id: { type: String, required: true, index: true },
  created_at: { type: Number, required: true },
  expires_at: { type: Number, required: true, index: true },
}, { versionKey: false });

const messageSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  address_id: { type: String, required: true, index: true },
  thread_id: { type: String, required: true, index: true },
  direction: { type: String, required: true, enum: ['inbound', 'outbound'] },
  from_addr: { type: String, required: true },
  from_name: { type: String, default: '' },
  to_addr: { type: String, required: true },
  subject: { type: String, default: '' },
  body_text: { type: String, default: '' },
  body_html: { type: String, default: '' },
  headers_json: { type: String, default: null },
  in_reply_to: { type: String, default: null },
  created_at: { type: Number, required: true },
  is_read: { type: Boolean, default: false },
}, { versionKey: false });

messageSchema.index({ address_id: 1, created_at: -1 });

const replyLogSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  address_id: { type: String, required: true, index: true },
  message_id: { type: String, default: null },
  sent_at: { type: Number, required: true },
}, { versionKey: false });

replyLogSchema.index({ address_id: 1, sent_at: 1 });

export const Address = mongoose.models.Address || mongoose.model('Address', addressSchema);
export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export const ReplyLog = mongoose.models.ReplyLog || mongoose.model('ReplyLog', replyLogSchema);

export { toRow };
