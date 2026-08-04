import { Roboto_Flex, Roboto_Mono } from "next/font/google";

export const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: "swap",
});

export const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const instrumentSerif = robotoFlex;
export const instrumentSerifItalic = robotoFlex;
