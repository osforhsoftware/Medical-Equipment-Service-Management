import React from "react";
import { formatCurrency, formatDate } from "@/lib/format";

interface PackingListPrintProps {
  order: {
    reference: string;
    createdAt: string;
    customerName: string;
    deliveredAt?: string | null;
    deliveryStatus: string;
    notes?: string | null;
    lines: Array<{
      id: string;
      description: string;
      sku?: string | null;
      type: string;
      quantity: number;
    }>;
  };
  customerAddress?: string | null;
  customerPhone?: string | null;
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
}

export function PackingListPrint({
  order,
  customerAddress,
  customerPhone,
  companyName,
  companyAddress,
  companyPhone,
}: PackingListPrintProps) {
  return (
    <div className="hidden print:block print:p-8 print:text-black print:bg-white text-sans">
      {/* Header */}
      <div className="flex justify-between items-start border-b pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">{companyName}</h1>
          {companyAddress && <p className="text-xs text-gray-600">{companyAddress}</p>}
          {companyPhone && <p className="text-xs text-gray-600">Tel: {companyPhone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase tracking-wider text-gray-800">PACKING LIST / DELIVERY NOTE</h2>
          <p className="text-sm font-mono mt-1">Ref: {order.reference}</p>
          <p className="text-xs text-gray-600">Date: {formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Deliver To */}
      <div className="grid grid-cols-2 gap-4 border rounded-md p-4 mb-6 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Ship To / Customer</p>
          <p className="font-bold text-base">{order.customerName}</p>
          {customerAddress && <p className="text-gray-700">{customerAddress}</p>}
          {customerPhone && <p className="text-gray-700">Phone: {customerPhone}</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Dispatch Details</p>
          <p>Delivery Status: <span className="font-semibold uppercase">{order.deliveryStatus}</span></p>
          {order.deliveredAt && <p>Dispatch Date: {formatDate(order.deliveredAt)}</p>}
          {order.notes && <p className="text-xs text-gray-600 mt-1 italic">Instructions: {order.notes}</p>}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-left border-collapse mb-8 text-sm">
        <thead>
          <tr className="border-b-2 border-gray-800 bg-gray-100 text-xs font-bold uppercase">
            <th className="py-2 px-3 w-12 text-center">#</th>
            <th className="py-2 px-3">Item Description</th>
            <th className="py-2 px-3 w-32">SKU / Code</th>
            <th className="py-2 px-3 w-24 text-center">Packed Qty</th>
            <th className="py-2 px-3 w-28 text-center font-normal italic">Verified (✓)</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, idx) => (
            <tr key={line.id} className="border-b border-gray-300">
              <td className="py-3 px-3 text-center text-gray-600">{idx + 1}</td>
              <td className="py-3 px-3 font-semibold">{line.description}</td>
              <td className="py-3 px-3 font-mono text-xs">{line.sku || "—"}</td>
              <td className="py-3 px-3 text-center font-bold tabular-nums text-base">{line.quantity}</td>
              <td className="py-3 px-3 text-center border-l">
                <div className="w-6 h-6 border border-gray-400 mx-auto rounded"></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures Footer */}
      <div className="grid grid-cols-3 gap-6 pt-12 border-t text-xs text-gray-700 text-center">
        <div>
          <div className="border-b border-gray-400 h-12 mb-2"></div>
          <p className="font-semibold">Prepared By / Store</p>
        </div>
        <div>
          <div className="border-b border-gray-400 h-12 mb-2"></div>
          <p className="font-semibold">Dispatched By / Courier</p>
        </div>
        <div>
          <div className="border-b border-gray-400 h-12 mb-2"></div>
          <p className="font-semibold">Received By (Customer Stamp & Sign)</p>
        </div>
      </div>
    </div>
  );
}
