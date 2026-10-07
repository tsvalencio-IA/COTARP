package br.com.thiaguinhosolucoes.transcritor;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SecureKeyStore {
    private static final String STORE="AndroidKeyStore";
    private static final String ALIAS="thiaguinho_transcritor_groq_v12";
    private static final String PREF="transcritor_secure";
    private SecureKeyStore(){}

    private static SecretKey key() throws Exception {
        KeyStore ks=KeyStore.getInstance(STORE); ks.load(null);
        if(ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry)ks.getEntry(ALIAS,null)).getSecretKey();
        KeyGenerator kg=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,STORE);
        kg.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return kg.generateKey();
    }

    public static void save(Context c,String value) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key());
        byte[] ct=cipher.doFinal(value.trim().getBytes(StandardCharsets.UTF_8));
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
                .putString("ct",Base64.encodeToString(ct,Base64.NO_WRAP))
                .putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).apply();
    }

    public static String load(Context c) {
        try {
            SharedPreferences p=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
            String ct=p.getString("ct",""), iv=p.getString("iv","");
            if(ct.isEmpty()||iv.isEmpty()) return "";
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(ct,Base64.NO_WRAP)),StandardCharsets.UTF_8);
        } catch(Exception e){ return ""; }
    }
}
