<?php

class Demo extends IController
{
    public $layout = 'site';

    function init()
    {
        //CheckRights::checkUserRights();
    }

    /**
     * 默认index方法
     */
    public function index()
    {
        // 调用Model
        // Demo_Class::show();

        // 获取Admin表列表信息
        $adminRow = Demo_Class::adminList();

        // 获取Admin表单条信息
        $adminInfo = Demo_Class::adminInfo();

        // 错误跳转
        // IError::show(404,'支付接口类没有找到');

        // 跳转到模板
        $this->redirect('index');
    }

    /**
     * 测试方法控制器
     */
    public function demo_list()
    {
        echo 'demo';
        exit;
    }
}