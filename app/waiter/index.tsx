import React from "react";
import { Redirect } from "expo-router";

export default function WaiterIndex() {
  return <Redirect href="/waiter/orders" />;
}
