# dsh-workbench Git 推送脚本（核心逻辑）
# 必须保存为 UTF-8 **带 BOM** 编码（Windows PowerShell 5.1 依赖 BOM 识别 UTF-8）
# 启动入口是同目录的 git-push.bat（纯 ASCII 引导，不含任何中文）
# 仓库：https://github.com/yidiao/dsh-workbench

$ErrorActionPreference = 'Continue'
# 让 git 的 UTF-8 输出（中文文件名、中文提交信息）被正确解码显示
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 切到脚本所在目录（即仓库根目录）
Set-Location -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "========================================"
Write-Host "  dsh-workbench Git 推送脚本"
Write-Host "========================================"
Write-Host ""

# ---------- 检查是否是 Git 仓库 ----------
& git rev-parse --git-dir 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 当前目录不是 Git 仓库，请检查路径"
    Read-Host "按回车退出"
    exit 1
}

# 确保中文路径不被转义显示
& git config core.quotepath false | Out-Null

# ---------- 当前分支（不写死分支名） ----------
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null | Select-Object -First 1)
if (-not $branch) { $branch = 'main' }
Write-Host "[信息] 当前分支: $branch"
Write-Host ""

# ---------- 检查 origin 远程是否存在 ----------
& git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 未配置 origin 远程仓库，无法推送。当前远程列表:"
    & git remote -v | Write-Host
    Write-Host ""
    Write-Host "如需恢复 GitHub 远程，请手动执行:"
    Write-Host "  git remote add origin https://github.com/yidiao/dsh-workbench.git"
    Write-Host ""
    Read-Host "按回车退出"
    exit 1
}

# ---------- 检查本地是否领先远程（有未推送的 commit） ----------
& git fetch origin $branch --quiet 2>$null
$unpushed = 0
$cnt = & git rev-list --count "origin/$branch..HEAD" 2>$null
if ($LASTEXITCODE -eq 0 -and $cnt) {
    $unpushed = [int]($cnt | Select-Object -First 1)
}
else {
    Write-Host "[警告] 无法连接远程仓库，跳过领先检查（可能是网络问题）"
    Write-Host ""
}

if ($unpushed -gt 0) {
    Write-Host "[提示] 本地有 $unpushed 个未推送的提交（本地领先远程 $unpushed 个版本）"
    Write-Host ""
    $ans = Read-Host "是否直接推送这些已有提交，不创建新提交？(Y/N，默认Y)"
    if ($ans -notmatch '^[Nn]') {
        Write-Host "跳过提交步骤，直接尝试推送已有提交..."
        & git push origin $branch
        if ($LASTEXITCODE -eq 0) {
            Write-Host "========================================"
            Write-Host "  推送成功！"
            Write-Host "========================================"
            Write-Host ""
            Write-Host "GitHub 上的仓库已更新"
        }
        else {
            Write-Host ""
            Write-Host "========================================"
            Write-Host "  推送失败"
            Write-Host "========================================"
            Write-Host ""
            Write-Host "可能原因:"
            Write-Host "  1. 梯子未开启或不稳定（最常见）"
            Write-Host "  2. GitHub 暂时无法访问"
            Write-Host "  3. 本地与远程历史分叉，普通推送被拒绝（rejected / non-fast-forward）"
            Write-Host "  4. 凭据失效：Git Credential Manager 的 GitHub 令牌过期"
            Write-Host ""
            Write-Host "建议操作:"
            Write-Host "  - 检查梯子后，直接再次运行本脚本重试"
            Write-Host "  - 若凭据失效：运行 git push 按其提示重新登录 GitHub 后重试"
            Write-Host "  - 若日志里有 rejected / non-fast-forward：两边历史无关，"
            Write-Host "    不要执行 git pull（两边没有共同提交，pull 只会制造混乱）；"
            Write-Host "    确认远程没有独有内容后，手动执行一次性强制推送:"
            Write-Host "      git push origin $branch --force-with-lease"
            Write-Host ""
        }
        Write-Host ""
        Read-Host "按回车退出"
        exit 0
    }
}

# ---------- 检查是否有未提交的更改 ----------
$status = & git status --porcelain 2>$null
if ($status) {
    Write-Host "[提示] 检测到有未提交的更改:"
    $status | Write-Host
    Write-Host ""
    $msg = Read-Host "请输入提交信息 (直接回车使用默认[更新内容])"
    if (-not $msg) { $msg = "更新内容" }
    Write-Host ""
    Write-Host "[1/3] 添加所有更改..."
    & git add -A
    Write-Host "[2/3] 提交更改..."
    & git commit -m $msg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 提交失败"
        Read-Host "按回车退出"
        exit 1
    }
}
else {
    Write-Host "[提示] 没有未提交的更改，直接推送"
}

# ---------- 推送 ----------
Write-Host ""
Write-Host "[3/3] 推送到 GitHub..."
Write-Host "如果卡住，请检查梯子是否开启（耐心等待，不要关闭窗口）"
Write-Host ""
& git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "========================================"
    Write-Host "  推送成功！"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "GitHub 上的仓库已更新"
}
else {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  推送失败"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "可能原因:"
    Write-Host "  1. 梯子未开启或不稳定（最常见）"
    Write-Host "  2. GitHub 暂时无法访问"
    Write-Host "  3. 本地与远程历史分叉，普通推送被拒绝（rejected / non-fast-forward）"
    Write-Host "  4. 凭据失效：Git Credential Manager 的 GitHub 令牌过期"
    Write-Host ""
    Write-Host "建议操作:"
    Write-Host "  - 检查梯子后，直接再次运行本脚本重试"
    Write-Host "  - 若凭据失效：运行 git push 按其提示重新登录 GitHub 后重试"
    Write-Host "  - 若日志里有 rejected / non-fast-forward：两边历史无关，"
    Write-Host "    不要执行 git pull（两边没有共同提交，pull 只会制造混乱）；"
    Write-Host "    确认远程没有独有内容后，手动执行一次性强制推送:"
    Write-Host "      git push origin $branch --force-with-lease"
    Write-Host ""
}

Write-Host ""
Read-Host "按回车退出"
exit 0