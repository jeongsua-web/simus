import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest {
  return {name:"SIM:US",short_name:"SIM:US",start_url:"/participate",display:"standalone",background_color:"#f4f7f5",theme_color:"#176a43",
    icons:[{src:"/favicon.ico",sizes:"any",type:"image/x-icon"}]};
}
