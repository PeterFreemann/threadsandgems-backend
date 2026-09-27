import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

// TG-10001, TG-10002, ... safe even when two checkouts happen at the same moment.
export async function nextOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'order' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `TG-${10000 + counter.seq}`;
}

export default Counter;
