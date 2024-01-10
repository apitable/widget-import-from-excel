import React, {useState} from "react";
import {Button, Loading} from "@apitable/components";
import {useDatasheet, useActiveViewId, useFields} from "@apitable/widget-sdk";
import * as XLSX from "xlsx";

export const ExcelImport: React.FC = () => {
  const viewId = useActiveViewId();
  const datasheet = useDatasheet();
  const fields = useFields(viewId);
  const [progressState, setProgressState] = useState<boolean>(false);
  const fileInput = React.createRef<HTMLInputElement>();

  function addRecords(records: any[]) {
    var chunk = function (arr: any[], num: number) {
      num = num * 1 || 1;
      var ret: any[] = [];
      arr.forEach(function (item, i) {
        if (i % num === 0) {
          ret.push([]);
        }
        ret[ret.length - 1].push(item);
      });
      console.log(ret);
      return ret;
    };
    if (!datasheet) {
      return;
    }
    console.log(records.length);
    // try {
    //   datasheet.addRecords(records);
    // } catch (error) {
    //   alert(error);
    // }
    // TODO: Solve the problem of importing large amounts of data
    if (records.length > 2000) {
      chunk(records, 1000).forEach((recordList, index) => {
        setTimeout(async () => {
          console.log("Insert 1000 -" + index);
          datasheet.addRecords(recordList);
        }, index * 5500);
      });
      setTimeout(async () => {
        console.log("Completion of a large number of data imports");
        setProgressState(false);
      }, (records.length / 1000) * 5500);
    } else {
      datasheet.addRecords(records).then((value) => setProgressState(false));
    }
  }

  // Custom formatted dates
  function format(excelDate: any) {
    if (typeof excelDate === "number") {
      let step = new Date().getTimezoneOffset() <= 0 ? 25567 + 2 : 25567 + 1;
      let utc_days = Math.floor(excelDate - step);
      // 86400 => 24 * 60 * 60 => Total seconds in a day
      let utc_value = utc_days * 86400;
      // Total milliseconds in a day
      let date_info = new Date(utc_value * 1000);

      // error handling
      let fractional_day = excelDate - Math.floor(excelDate) + 0.0000001;
      // Total seconds since 1970 to present
      let total_seconds = Math.floor(86400 * fractional_day);

      let seconds = total_seconds % 60;

      total_seconds -= seconds;

      let hours = Math.floor(total_seconds / (60 * 60));
      let minutes = Math.floor(total_seconds / 60) % 60;

      return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds).getTime();
    } else if (typeof excelDate === "string") {
      // String needs to be 2001/10/01 10:11:01
      excelDate = excelDate.substring(0, 19);
      // Must convert date '-' to '/'
      excelDate = excelDate.replace(/-/g, "/");
      const timestamp = new Date(excelDate).getTime();
      return timestamp;
    } else {
      console.log("File contains incorrect date data", excelDate);
      return null;
    }
  }
  //File Selection
  function selectFile() {
    fileInput.current?.click();
  }
  const onImportExcel = (file) => {
    const mention = confirm(
      "Please note: The column names in the import file should be exactly the same as those in the table; the Computed, Member, Attachment and Link type field is not supported."
    );

    // Get the uploaded file object
    const {files} = file.target;

    // Reading a file through a FileReader object
    const fileReader = new FileReader();

    // Opening a file as a binary
    fileReader.readAsBinaryString(files[0]);

    if (!mention) return null;

    setProgressState(true);

    fileReader.onload = (event) => {
      try {
        const target = event.target?.result;
        // Read the entire excel table object as a binary stream.
        const wb = XLSX.read(target, {
          type: "binary",
          cellText: false,
          cellDates: false,
        });
        // By default, only the first table is read; the
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Use sheet_to_json method to convert excel to json data.
        const data: any[] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
        });
        // console.log("Origin Data: ", data);

        const records: Object[] = [];
        const header: any[] = data[0];
        const fieldNames: any[] = fields.map((field) => field.name);
        const intersection = fieldNames.filter(function (fieldName) {
          return header.indexOf(fieldName) > -1;
        });

        // console.log("Fields of the imported file:", header);

        if (intersection.length === 0) {
          alert("Imported file does not have the same columns as the current table");
          setProgressState(false);
          return;
        }

        console.log("Fields with intersections: ", intersection);

        data.shift();
        if (data.length === 0) {
          alert("The data in the import file is empty");
          setProgressState(false);
          return;
        }

        const newData: any[] = data.filter(function (s: any[]) {
          return s.length != 0 && s;
        });
        const newDataNum = newData.length;

        let bigDataWarning: Boolean =
          newDataNum > 10000
            ? confirm(
                "Please note: the current imported data is large, the synchronization process is likely to lead to table lag, slow synchronization, etc., the extent of the situation depends on the equipment and network conditions"
              )
            : true;

        if (bigDataWarning) {
          // Defining data handling
          const handleDateTimeType = (data: any) => format(data);
          const handleCheckboxType = (data: any) => (data === 1 || data === true ? true : false);
          const handleMultiSelectType = (data: any) => String(data).split(",");
          const handleCurrencyType = (data: any) => {
            // Avoid currency symbols in source data
            return typeof data != "number" ? Number(data.match(/-?[0-9]+(.[0-9]+)?/)[0]) : data;
          };
          const handlePercentType = (data: any) => {
            // Percentage type field handling
            return typeof data === "number"
              ? data
              : data.match("%")
              ? Number(data.match(/-?[0-9]+(.[0-9]+)?/)[0])
              : Number(data.match(/-?[0-9]+(.[0-9]+)?/)[0]) * 100;
          };
          const handleNumberType = (data: any) => {
            // Handling of numeric type fields
            return typeof data === "number" ? data : Number(data.match(/-?[0-9]+(.[0-9]+)?/)[0]);
          };

          // Define data processing mappings
          let fieldHandle = {
            DateTime: handleDateTimeType,
            Number: handleNumberType,
            Checkbox: handleCheckboxType,
            MultiSelect: handleMultiSelectType,
            Currency: handleCurrencyType,
            Percent: handlePercentType,
            Rating: handleNumberType,
          };

          newData.forEach((record: any[]) => {
            const valuesMap = new Object();

            fields.map((field) => {
              const specialType = ["Attachment", "Member", "MagicLink"];

              if (field.isComputed || specialType.includes(field.type)) return;

              // Find out where each field of the viger table is located in the imported file
              const index: number = header.indexOf(field.name);

              if (index === -1) return;
              try {
                let handleType = fieldHandle[field.type];
                var parseData =
                  !String(record[index]) || String(record[index]) === "undefined"
                    ? null
                    : field.type in fieldHandle
                    ? handleType(record[index])
                    : String(record[index]);
                if (typeof parseData === "number" && isNaN(parseData)) {
                  parseData = null;
                }
                valuesMap[field.id] = parseData;
              } catch (error) {
                valuesMap[field.id] = null;
              }
            });
            records.push({valuesMap});
          });
          // console.log(records);
          addRecords(records);
        } else {
          setProgressState(false);
          return;
        }
      } catch (e) {
        console.log(e);
        alert(e);
        setProgressState(false);
        return;
      }
    };

    // Empty the selected file
    fileReader.onloadend = (event) => {
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    };
  };
  return progressState ? (
    <Loading />
  ) : (
    <div>
      <div role="upload" onClick={selectFile}>
        <input type="file" ref={fileInput} accept=".xlsx, .xls, .csv" style={{display: "none"}} id="inputfile" onChange={onImportExcel} />
        <Button color="primary">Click to start importing file</Button>
      </div>
      <p
        style={{
          paddingTop: "10px",
          fontSize: "12px",
          textAlign: "center",
          color: "GrayText",
        }}
      >
        Only supports .xlsx .xls .csv
      </p>
      <div
        style={{
          textAlign: "center",
          fontSize: "12px",
          color: "#7b67ee",
          cursor: "pointer",
        }}
        onClick={() => {
          window.open("https://help.aitable.ai/docs/guide/intro-widget-import-from-excel", "_blank");
        }}
      >
        View the tutorial
      </div>
    </div>
  );
};
