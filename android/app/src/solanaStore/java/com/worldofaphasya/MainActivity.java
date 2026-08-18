package com.worldofaphasya;

public final class MainActivity extends BaseMainActivity {
    @Override
    protected void registerDistributionPlugins() {
        registerPlugin(NativeSolanaMobilePlugin.class);
    }
}
