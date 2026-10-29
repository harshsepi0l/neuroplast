import type { ComponentProps } from "react";
import { Input as EasyInput } from "../easyui/Form";
export function Input(props: ComponentProps<"input">) { return <EasyInput {...props}/>; }
