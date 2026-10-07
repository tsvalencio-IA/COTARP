package br.com.thiaguinhosolucoes.transcritor;

import android.content.Context;
import android.net.Uri;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

public final class GroqApi {
    private static final String URL_TRANSCRIBE="https://api.groq.com/openai/v1/audio/transcriptions";
    private static final String URL_MODELS="https://api.groq.com/openai/v1/models";
    private GroqApi(){}

    public static void test(String key) throws Exception {
        HttpsURLConnection c=(HttpsURLConnection)new URL(URL_MODELS).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(20000);
        c.setRequestProperty("Authorization","Bearer "+key.trim());
        int code=c.getResponseCode();
        if(code<200||code>=300) throw new Exception("Chave Groq recusada ("+code+").");
    }

    public static String transcribe(Context ctx,Uri uri,String fileName,String mime,String key) throws Exception {
        String boundary="----TranscritorIA"+System.currentTimeMillis();
        HttpsURLConnection c=(HttpsURLConnection)new URL(URL_TRANSCRIBE).openConnection();
        c.setConnectTimeout(30000); c.setReadTimeout(600000);
        c.setRequestMethod("POST"); c.setDoOutput(true); c.setChunkedStreamingMode(64*1024);
        c.setRequestProperty("Authorization","Bearer "+key.trim());
        c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
        try(DataOutputStream out=new DataOutputStream(c.getOutputStream())) {
            field(out,boundary,"model","whisper-large-v3-turbo");
            field(out,boundary,"language","pt");
            field(out,boundary,"response_format","json");
            field(out,boundary,"temperature","0");
            out.writeBytes("--"+boundary+"\r\n");
            out.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\""+safe(fileName)+"\"\r\n");
            out.writeBytes("Content-Type: "+(mime==null?"audio/ogg":mime)+"\r\n\r\n");
            try(InputStream in=new BufferedInputStream(ctx.getContentResolver().openInputStream(uri))) {
                byte[] buf=new byte[65536]; int n;
                while((n=in.read(buf))!=-1) out.write(buf,0,n);
            }
            out.writeBytes("\r\n--"+boundary+"--\r\n");
        }
        int code=c.getResponseCode();
        String body=read(code>=200&&code<300?c.getInputStream():c.getErrorStream());
        if(code<200||code>=300) throw new Exception("Groq retornou "+code+": "+body);
        JSONObject j=new JSONObject(body);
        return j.optString("text","").trim();
    }

    private static void field(DataOutputStream out,String b,String name,String value)throws Exception{
        out.writeBytes("--"+b+"\r\n");
        out.writeBytes("Content-Disposition: form-data; name=\""+name+"\"\r\n\r\n");
        out.write(value.getBytes(StandardCharsets.UTF_8));
        out.writeBytes("\r\n");
    }
    private static String safe(String s){ return s==null?"audio_whatsapp.ogg":s.replace("\"","").replace("\r","").replace("\n",""); }
    private static String read(InputStream in)throws Exception{
        if(in==null)return "";
        try(BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))){
            StringBuilder sb=new StringBuilder(); String line; while((line=r.readLine())!=null) sb.append(line);
            return sb.toString();
        }
    }
}
