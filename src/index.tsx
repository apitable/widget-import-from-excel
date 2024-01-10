import React from "react";
import {initializeWidget, useDatasheet} from "@apitable/widget-sdk";
import {Wrong} from "./wrong";
import {ExcelImport} from "./excel_import";

export const HelloWorld: React.FC = () => {
  const datasheet = useDatasheet();
  const permission = datasheet?.checkPermissionsForAddRecord();

  return (
    <div
      style={{
        display: "flex",
        alignContent: "center",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      {permission?.acceptable ? <ExcelImport /> : <Wrong description="Permissions are read-only and write operations are not possible" />}
    </div>
  );
};

initializeWidget(HelloWorld, process.env.WIDGET_PACKAGE_ID);
