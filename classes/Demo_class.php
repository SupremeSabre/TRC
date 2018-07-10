<?php

class Demo_Class
{
    /**
     * 获取数据表信息输出
     */
    public function adminList()
    {
        // 获取user表列表
        $adminObj     = new IModel('user');
        $adminRow      = $adminObj->query();
        return $adminRow;
    }


    /**
     * 获取数据表信息输出
     */
    public function adminInfo()
    {
        // 获取admin表用户列表
        $adminObj     = new IModel('admin');
        $adminRow      = $adminObj->getObj('admin_name = "admin"');
        return $adminRow;
    }


    /**
     * 普通输出
     */
    public static function show()
    {
        echo '我是哪个啊';
    }

}